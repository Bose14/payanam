import 'dart:math' as math;

class GeoMath {
  static const double earthRadiusKm = 6371.0;
  static const double earthRadiusMeters = 6371000.0;

  /// Haversine distance in meters between two lat/lng points
  static double distanceMeters(
    double lat1,
    double lng1,
    double lat2,
    double lng2,
  ) {
    final dLat = _degToRad(lat2 - lat1);
    final dLng = _degToRad(lng2 - lng1);
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(_degToRad(lat1)) *
            math.cos(_degToRad(lat2)) *
            math.sin(dLng / 2) *
            math.sin(dLng / 2);
    final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    return earthRadiusMeters * c;
  }

  /// Distance in kilometers
  static double distanceKm(
    double lat1,
    double lng1,
    double lat2,
    double lng2,
  ) {
    return distanceMeters(lat1, lng1, lat2, lng2) / 1000.0;
  }

  /// Calculates heading angle in degrees (0..360) from point A to point B
  static double calculateBearing(
    double lat1,
    double lng1,
    double lat2,
    double lng2,
  ) {
    final dLng = _degToRad(lng2 - lng1);
    final phi1 = _degToRad(lat1);
    final phi2 = _degToRad(lat2);

    final y = math.sin(dLng) * math.cos(phi2);
    final x = math.cos(phi1) * math.sin(phi2) -
        math.sin(phi1) * math.cos(phi2) * math.cos(dLng);

    final bearing = math.atan2(y, x);
    return (_radToDeg(bearing) + 360) % 360;
  }

  /// Minimum distance in meters from a point to a segmented polyline corridor
  static double minDistanceToPolyline(
    double pointLat,
    double pointLng,
    List<List<double>> polylinePoints, // list of [lat, lng]
  ) {
    if (polylinePoints.isEmpty) return double.infinity;
    if (polylinePoints.length == 1) {
      return distanceMeters(
        pointLat,
        pointLng,
        polylinePoints[0][0],
        polylinePoints[0][1],
      );
    }

    double minDistance = double.infinity;
    for (int i = 0; i < polylinePoints.length - 1; i++) {
      final p1 = polylinePoints[i];
      final p2 = polylinePoints[i + 1];
      final dist = _distToSegment(pointLat, pointLng, p1[0], p1[1], p2[0], p2[1]);
      if (dist < minDistance) {
        minDistance = dist;
      }
    }
    return minDistance;
  }

  static double _distToSegment(
    double px,
    double py,
    double ax,
    double ay,
    double bx,
    double by,
  ) {
    final l2 = distanceMeters(ax, ay, bx, by);
    if (l2 == 0) return distanceMeters(px, py, ax, ay);

    // Flat earth approximation for short segment projection
    final t = math.max(
      0.0,
      math.min(
        1.0,
        ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) /
            ((bx - ax) * (bx - ax) + (by - ay) * (by - ay) + 1e-9),
      ),
    );

    final projLat = ax + t * (bx - ax);
    final projLng = ay + t * (by - ay);
    return distanceMeters(px, py, projLat, projLng);
  }

  static double _degToRad(double deg) => deg * (math.pi / 180.0);
  static double _radToDeg(double rad) => rad * (180.0 / math.pi);
}
