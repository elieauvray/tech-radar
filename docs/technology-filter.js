// Pure logic for the Type / Status filters of the radar page: allowed values,
// URL query string parsing and building, row matching and the counter text.
// Shared by the browser and the tests.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./technology-mapping.js"));
  } else {
    root.TechnologyFilter = factory(root.TechnologyMapping);
  }
}(typeof self !== "undefined" ? self : this, function (TechnologyMapping) {
  // The "All" value of both dropdowns.
  var ALL = "";

  var TYPES = TechnologyMapping.TYPE_ORDER.slice();
  var STATUSES = Object.keys(TechnologyMapping.STATUSES);

  // Returns the value when it is one of the allowed strings, "" otherwise.
  // Case-sensitive; non-strings (arrays, objects, ...) are rejected, and
  // inherited keys such as "__proto__" or "toString" are never allowed.
  function allowed(list, value) {
    return typeof value === "string" && list.indexOf(value) !== -1 ? value : ALL;
  }

  function own(obj, key) {
    return obj !== null && typeof obj === "object" &&
      Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : ALL;
  }

  function normalizeFilters(obj) {
    return {
      type: allowed(TYPES, own(obj, "type")),
      status: allowed(STATUSES, own(obj, "status"))
    };
  }

  // Reads the filters from a query string such as "?type=Datastores&status=HOLD".
  // The first value of each parameter is used; unknown values are ignored.
  function parseFilters(search) {
    var params = new URLSearchParams(typeof search === "string" ? search : "");
    var type = params.get("type");
    var status = params.get("status");
    return normalizeFilters({
      type: type === null ? ALL : type,
      status: status === null ? ALL : status
    });
  }

  // Returns the query string ("" or "?...") for `currentSearch` with only the
  // `type` and `status` parameters set (or removed when "All").
  function buildSearch(filters, currentSearch) {
    var clean = normalizeFilters(filters);
    var params = new URLSearchParams(typeof currentSearch === "string" ? currentSearch : "");
    params.delete("type");
    params.delete("status");
    if (clean.type !== ALL) params.set("type", clean.type);
    if (clean.status !== ALL) params.set("status", clean.status);
    var query = params.toString();
    return query === "" ? "" : "?" + query;
  }

  function isActive(filters) {
    var clean = normalizeFilters(filters);
    return clean.type !== ALL || clean.status !== ALL;
  }

  // A row matches when it satisfies every active filter (AND).
  function matches(row, filters) {
    var clean = normalizeFilters(filters);
    return (clean.type === ALL || row.type === clean.type) &&
      (clean.status === ALL || row.status === clean.status);
  }

  function countMatches(rows, filters) {
    var count = 0;
    for (var i = 0; i < rows.length; i++) {
      if (matches(rows[i], filters)) count++;
    }
    return count;
  }

  function counterText(n, m) {
    return "Showing " + n + " of " + m + " technologies";
  }

  return {
    ALL: ALL,
    TYPES: TYPES,
    STATUSES: STATUSES,
    normalizeFilters: normalizeFilters,
    parseFilters: parseFilters,
    buildSearch: buildSearch,
    isActive: isActive,
    matches: matches,
    countMatches: countMatches,
    counterText: counterText
  };
}));
