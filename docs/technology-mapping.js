// Mapping between the domain values stored in the `technologies` table
// (type / status / trend) and the numeric values used by radar_visualization
// (quadrant / ring / moved). Shared by the browser, the seed and the tests.
(function (root, factory) {
  var mapping = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = mapping;
  } else {
    root.TechnologyMapping = mapping;
  }
}(typeof self !== "undefined" ? self : this, function () {
  var TYPES = {
    "Language": 0,
    "Infrastructure": 1,
    "Datastores": 2,
    "Data Management": 3
  };

  var STATUSES = {
    "ADOPT": 0,
    "TRIAL": 1,
    "ASSESS": 2,
    "HOLD": 3
  };

  var TRENDS = {
    "moved up": 1,
    "moved down": -1,
    "new": 2,
    "no change": 0
  };

  function invert(table) {
    var result = {};
    Object.keys(table).forEach(function (key) {
      result[table[key]] = key;
    });
    return result;
  }

  var QUADRANT_TO_TYPE = invert(TYPES);
  var RING_TO_STATUS = invert(STATUSES);
  var MOVED_TO_TREND = invert(TRENDS);

  function lookup(table, value, kind) {
    if (!Object.prototype.hasOwnProperty.call(table, value)) {
      throw new Error("Unknown " + kind + ": " + JSON.stringify(value));
    }
    return table[value];
  }

  function typeToQuadrant(type) {
    return lookup(TYPES, type, "type");
  }

  function statusToRing(status) {
    return lookup(STATUSES, status, "status");
  }

  function trendToMoved(trend) {
    return lookup(TRENDS, trend, "trend");
  }

  function quadrantToType(quadrant) {
    return lookup(QUADRANT_TO_TYPE, quadrant, "quadrant");
  }

  function ringToStatus(ring) {
    return lookup(RING_TO_STATUS, ring, "ring");
  }

  function movedToTrend(moved) {
    return lookup(MOVED_TO_TREND, moved, "moved");
  }

  function toRadarEntry(row) {
    return {
      id: String(row.number),
      label: row.title,
      description: row.description,
      quadrant: typeToQuadrant(row.type),
      ring: statusToRing(row.status),
      moved: trendToMoved(row.trend),
      active: true
    };
  }

  return {
    TYPES: TYPES,
    STATUSES: STATUSES,
    TRENDS: TRENDS,
    QUADRANT_TO_TYPE: QUADRANT_TO_TYPE,
    RING_TO_STATUS: RING_TO_STATUS,
    MOVED_TO_TREND: MOVED_TO_TREND,
    typeToQuadrant: typeToQuadrant,
    statusToRing: statusToRing,
    trendToMoved: trendToMoved,
    quadrantToType: quadrantToType,
    ringToStatus: ringToStatus,
    movedToTrend: movedToTrend,
    toRadarEntry: toRadarEntry
  };
}));
