import '../../core/utils/geo_math.dart';

class DeviationAlert {
  final String riderId;
  final String riderName;
  final double distanceOffRouteMeters;
  final DateTime detectedAt;

  DeviationAlert({
    required this.riderId,
    required this.riderName,
    required this.distanceOffRouteMeters,
    required this.detectedAt,
  });
}

class RouteDeviationDetector {
  final double corridorRadiusMeters;
  final Duration persistenceRequirement;
  final double maxTolerableAccuracyMeters;

  final Map<String, DateTime> _deviationStartTimes = {};

  RouteDeviationDetector({
    this.corridorRadiusMeters = 200.0,
    this.persistenceRequirement = const Duration(seconds: 30),
    this.maxTolerableAccuracyMeters = 25.0,
  });

  /// Evaluates whether a rider is outside the route polyline corridor
  DeviationAlert? evaluateRider(
    String riderId,
    String riderName,
    double latitude,
    double longitude,
    double accuracyMeters,
    List<List<double>> routeCoordinates,
  ) {
    // If GPS accuracy is poor (e.g. inside tunnel or high noise), suppress alerts
    if (accuracyMeters > maxTolerableAccuracyMeters) {
      _deviationStartTimes.remove(riderId);
      return null;
    }

    if (routeCoordinates.isEmpty) return null;

    final distanceMeters = GeoMath.minDistanceToPolyline(
      latitude,
      longitude,
      routeCoordinates,
    );

    final now = DateTime.now();

    if (distanceMeters > corridorRadiusMeters) {
      final firstObserved = _deviationStartTimes.putIfAbsent(riderId, () => now);
      if (now.difference(firstObserved) >= persistenceRequirement) {
        return DeviationAlert(
          riderId: riderId,
          riderName: riderName,
          distanceOffRouteMeters: distanceMeters,
          detectedAt: now,
        );
      }
    } else {
      _deviationStartTimes.remove(riderId);
    }

    return null;
  }

  void reset() {
    _deviationStartTimes.clear();
  }
}
