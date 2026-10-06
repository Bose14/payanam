import 'dart:async';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../shared/models/rider_telemetry.dart';

class RealtimeTelemetryService {
  final SupabaseClient supabase;
  RealtimeChannel? _telemetryChannel;
  final StreamController<RiderTelemetry> _peerStreamController =
      StreamController<RiderTelemetry>.broadcast();

  Stream<RiderTelemetry> get peerTelemetryStream => _peerStreamController.stream;

  RealtimeTelemetryService({required this.supabase});

  /// Connect to the ride's ephemeral WebSocket channel for high-frequency location sharing
  Future<void> joinRideChannel(String rideId, RiderTelemetry initialTelemetry) async {
    await leaveRideChannel();

    final channelName = 'ride:telemetry:$rideId';
    _telemetryChannel = supabase.channel(channelName);

    // 1. Listen to broadcast telemetry from peers
    _telemetryChannel!.onBroadcast(
      event: 'location_update',
      callback: (payload) {
        try {
          final telemetry = RiderTelemetry.fromJson(payload);
          _peerStreamController.add(telemetry);
        } catch (e) {
          // Ignore malformed broadcast packets
        }
      },
    );

    // 2. Track presence for online/offline rider status
    _telemetryChannel!.onPresenceSync((payload) {
      // Handles riders entering/exiting ride
    });

    await _telemetryChannel!.subscribe();

    // Track user presence
    await _telemetryChannel!.track({
      'user_id': initialTelemetry.userId,
      'name': initialTelemetry.name,
      'online_at': DateTime.now().toIso8601String(),
    });
  }

  /// Broadcast device's current location to ride channel (zero DB write overhead)
  Future<void> broadcastLocation(RiderTelemetry telemetry) async {
    if (_telemetryChannel == null) return;

    await _telemetryChannel!.sendBroadcastMessage(
      event: 'location_update',
      payload: telemetry.toJson(),
    );
  }

  Future<void> leaveRideChannel() async {
    if (_telemetryChannel != null) {
      await supabase.removeChannel(_telemetryChannel!);
      _telemetryChannel = null;
    }
  }

  void dispose() {
    _peerStreamController.close();
  }
}
