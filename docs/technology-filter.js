// Filter rules for the Type / Status dropdowns in the page header.
// Pure functions only, shared by the browser and the tests. A filter is
// represented as { type: "", status: "" } where "" means "All".
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./technology-mapping.js"));
  } else {
    root.TechnologyFilter = factory(root.TechnologyMapping);
  }
}(typeof self !== "undefined" ? self : this, function (TechnologyMapping) {
  var ALL = "";

  function hasOwn(table, value) {
    return typeof value === "string" &&
      Object.prototype.hasOwnProperty.call(table, value);
  }

  // Keep a value only if it is a canonical type / status, otherwise "All".
  function normalizeFilters(raw) {
    var source = raw !== null && typeof raw === "object" ? raw : {};
    return {
      type: hasOwn(TechnologyMapping.TYPES, source.type) ? source.type : ALL,
      status: hasOwn(TechnologyMapping.STATUSES, source.status) ? source.status : ALL
    };
  }

  // Reads ?type=...&status=... Unknown values are ignored per parameter.
  function parseQuery(search) {
    var params = new URLSearchParams(typeof search === "string" ? search : "");
    return normalizeFilters({
      type: params.get("type"),
      status: params.get("status")
    });
  }

  // Returns "" or e.g. "?type=Datastores&status=HOLD" ("All" is omitted).
  function toQuery(filters) {
    var clean = normalizeFilters(filters);
    var params = new URLSearchParams();
    if (clean.type !== ALL) params.set("type", clean.type);
    if (clean.status !== ALL) params.set("status", clean.status);
    var query = params.toString();
    return query === "" ? "" : "?" + query;
  }

  function isActive(filters) {
    var clean = normalizeFilters(filters);
    return clean.type !== ALL || clean.status !== ALL;
  }

  // row: { type, status }. Both conditions must hold (AND).
  function matches(row, filters) {
    var clean = normalizeFilters(filters);
    if (clean.type !== ALL && row.type !== clean.type) return false;
    if (clean.status !== ALL && row.status !== clean.status) return false;
    return true;
  }

  function countMatches(rows, filters) {
    var count = 0;
    rows.forEach(function (row) {
      if (matches(row, filters)) count += 1;
    });
    return count;
  }

  function counterText(shown, total) {
    return "Showing " + shown + " of " + total + " technologies";
  }

  return {
    ALL: ALL,
    TYPE_OPTIONS: TechnologyMapping.TYPE_ORDER.slice(),
    STATUS_OPTIONS: Object.keys(TechnologyMapping.STATUSES),
    normalizeFilters: normalizeFilters,
    parseQuery: parseQuery,
    toQuery: toQuery,
    isActive: isActive,
    matches: matches,
    countMatches: countMatches,
    counterText: counterText
  };
}));
