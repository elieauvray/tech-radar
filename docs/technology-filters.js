// Type / Status filters for the radar page. Pure logic, shared by the browser
// (window.TechnologyFilters) and the tests. A filter value of null means "All".
(function (root, factory) {
  var mapping = (typeof module === "object" && module.exports)
    ? require("./technology-mapping.js")
    : root.TechnologyMapping;
  var filters = factory(mapping);
  if (typeof module === "object" && module.exports) {
    module.exports = filters;
  } else {
    root.TechnologyFilters = filters;
  }
}(typeof self !== "undefined" ? self : this, function (TechnologyMapping) {
  var TYPE_OPTIONS = TechnologyMapping.TYPE_ORDER.slice();
  var STATUS_OPTIONS = Object.keys(TechnologyMapping.STATUSES);

  function known(table, value) {
    return typeof value === "string" &&
      Object.prototype.hasOwnProperty.call(table, value);
  }

  // Unknown or empty values become null ("All").
  function normalizeFilters(filters) {
    filters = filters || {};
    return {
      type: known(TechnologyMapping.TYPES, filters.type) ? filters.type : null,
      status: known(TechnologyMapping.STATUSES, filters.status) ? filters.status : null
    };
  }

  // Reads the filters from a query string such as "?type=Datastores&status=HOLD".
  function parseFilters(search) {
    var params = new URLSearchParams(search || "");
    return normalizeFilters({
      type: params.get("type"),
      status: params.get("status")
    });
  }

  // Builds the query string for the filters, keeping any other parameter of
  // currentSearch. Returns "" when nothing is left.
  function toSearch(filters, currentSearch) {
    var normalized = normalizeFilters(filters);
    var params = new URLSearchParams(currentSearch || "");
    if (normalized.type) {
      params.set("type", normalized.type);
    } else {
      params.delete("type");
    }
    if (normalized.status) {
      params.set("status", normalized.status);
    } else {
      params.delete("status");
    }
    var query = params.toString();
    return query ? "?" + query : "";
  }

  function isActive(filters) {
    var normalized = normalizeFilters(filters);
    return normalized.type !== null || normalized.status !== null;
  }

  // AND of both filters on a row with `type` and `status`.
  function matches(row, filters) {
    var normalized = normalizeFilters(filters);
    return (normalized.type === null || row.type === normalized.type) &&
      (normalized.status === null || row.status === normalized.status);
  }

  // Same as matches, for a radar_visualization entry (quadrant / ring).
  function entryMatches(entry, filters) {
    return matches({
      type: TechnologyMapping.quadrantToType(entry.quadrant),
      status: TechnologyMapping.ringToStatus(entry.ring)
    }, filters);
  }

  function countMatching(rows, filters) {
    return rows.filter(function (row) {
      return matches(row, filters);
    }).length;
  }

  function summaryText(shown, total) {
    return "Showing " + shown + " of " + total + " technologies";
  }

  return {
    TYPE_OPTIONS: TYPE_OPTIONS,
    STATUS_OPTIONS: STATUS_OPTIONS,
    normalizeFilters: normalizeFilters,
    parseFilters: parseFilters,
    toSearch: toSearch,
    isActive: isActive,
    matches: matches,
    entryMatches: entryMatches,
    countMatching: countMatching,
    summaryText: summaryText
  };
}));
