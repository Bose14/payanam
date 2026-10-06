import 'package:equatable/equatable.dart';

enum RiderStatus {
  riding,
  stopped,
  emergency,
  offline,
}

class RiderTelemetry extends Equatable {
  final String userId;
  final String name;
  final String? bikeModel;
  final String? avatarUrl;
  final double latitude;
  final double longitude;
  final double speedKmh;
  final double heading;
  final double accuracy;
  final RiderStatus status;
  final int? batteryLevel;
  final DateTime timestamp;

  const RiderTelemetry({
    required this.userId,
    required this.name,
    this.bikeModel,
    this.avatarUrl,
    required this.latitude,
    required this.longitude,
    required this.speedKmh,
    required this.heading,
    required this.accuracy,
    required this.status,
    this.batteryLevel,
    required this.timestamp,
  });

  factory RiderTelemetry.fromJson(Map<String, dynamic> json) {
    return RiderTelemetry(
      userId: json['user_id'] as String,
      name: json['name'] as String? ?? 'Rider',
      bikeModel: json['bike_model'] as String?,
      avatarUrl: json['avatar_url'] as String?,
      latitude: (json['lat'] as num).toDouble(),
      longitude: (json['lng'] as num).toDouble(),
      speedKmh: (json['speed_kmh'] as num?)?.toDouble() ?? 0.0,
      heading: (json['heading'] as num?)?.toDouble() ?? 0.0,
      accuracy: (json['accuracy'] as num?)?.toDouble() ?? 10.0,
      status: RiderStatus.values.firstWhere(
        (s) => s.name == json['status'],
        orElse: () => RiderStatus.riding,
      ),
      batteryLevel: json['battery'] as int?,
      timestamp: DateTime.fromMillisecondsSinceEpoch(
        json['timestamp'] as int? ?? DateTime.now().millisecondsSinceEpoch,
      ),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'user_id': userId,
      'name': name,
      'bike_model': bikeModel,
      'avatar_url': avatarUrl,
      'lat': latitude,
      'lng': longitude,
      'speed_kmh': speedKmh,
      'heading': heading,
      'accuracy': accuracy,
      'status': status.name,
      'battery': batteryLevel,
      'timestamp': timestamp.millisecondsSinceEpoch,
    };
  }

  RiderTelemetry copyWith({
    String? userId,
    String? name,
    String? bikeModel,
    String? avatarUrl,
    double? latitude,
    double? longitude,
    double? speedKmh,
    double? heading,
    double? accuracy,
    RiderStatus? status,
    int? batteryLevel,
    DateTime? timestamp,
  }) {
    return RiderTelemetry(
      userId: userId ?? this.userId,
      name: name ?? this.name,
      bikeModel: bikeModel ?? this.bikeModel,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      speedKmh: speedKmh ?? this.speedKmh,
      heading: heading ?? this.heading,
      accuracy: accuracy ?? this.accuracy,
      status: status ?? this.status,
      batteryLevel: batteryLevel ?? this.batteryLevel,
      timestamp: timestamp ?? this.timestamp,
    );
  }

  @override
  List<Object?> get props => [
        userId,
        latitude,
        longitude,
        speedKmh,
        heading,
        status,
        timestamp,
      ];
}
