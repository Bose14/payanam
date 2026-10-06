import 'dart:async';
import '../../core/utils/geo_math.dart';
import '../../shared/models/rider_telemetry.dart';

class SeparationAlert {
  final String riderId;
  final String riderName;
  final double distanceBehindKm;
  final DateTime detectedAt;

  SeparationAlert({
    required this.riderId,
    required this.riderName,
    required this.distanceBehindKm,
    required this.detectedAt,
  });
}

class SeparationDetector {
  final double thresholdKm;
  final Duration persistenceRequirement;
  
  // Tracks how long each rider has been separated
  final Map<String, DateTime> _gapStartTimes = {};

  SeparationDetector({
    this.thresholdKm = 2.0,
    this.persistenceRequirement = const Duration(seconds: 40),
  });

  /// Evaluates current active group positions and returns any persistent alerts.
  List<SeparationAlert> evaluateSeparation(
    List<RiderTelemetry> riders,
    {double? leadLat, double? leadLng}
  ) {
    final activeRiders = riders.where((r) => r.status != RiderStatus.offline).toList();
    if (activeRiders.length < 2) return [];

    // Find the lead rider (furthest ahead or by coordinates if provided)
    double maxProgress = 0.0;
    RiderTelemetry? leader;

    // Use first active rider as relative origin to compute relative distances
    final origin = activeRiders.first;
    for (final r in activeRiders) {
      final d = GeoMath.distanceKm(origin.latitude, origin.longitude, r.latitude, r.longitude);
      if (d >= maxProgress) {
        maxProgress = d;
        leader = r;
      }
    }

    if (leader == null) return [];

    final now = DateTime.now();
    final List<SeparationAlert> alerts = [];

    for (final rider in activeRiders) {
      if (rider.userId == leader.userId) {
        _gapStartTimes.remove(rider.userId);
        continue;
      }

      final gapKm = GeoMath.distanceKm(
        leader.latitude,
        leader.longitude,
        rider.latitude,
        rider.longitude,
      );

      if (gapKm >= thresholdKm) {
        final firstObserved = _gapStartTimes.putIfAbsent(rider.userId, () => now);
        if (now.difference(firstObserved) >= persistenceRequirement) {
          alerts.add(
            SeparationAlert(
              riderId: rider.userId,
              riderName: rider.name,
              distanceBehindKm: gapKm,
              detectedAt: now,
            ),
          );
        }
      } else {
        _gapStartTimes.remove(rider.userId);
      }
    }

    return alerts;
  }

  void reset() {
    _gapStartTimes.clear();
  }
}
