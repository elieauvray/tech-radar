// Pure logic of the Type / Status filters of the radar page: which values are
// valid, how the filters are read from and written to the URL query string, and
// which technologies match. "" always means "All". No DOM access, so it can be
// unit tested in node.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./technology-mapping.js"));
  } else {
    root.TechnologyFilter = factory(root.TechnologyMapping);
  }
}(typeof self !== "undefined" ? self : this, function (TechnologyMapping) {
  var ALL_TYPES = "All types";
  var ALL_STATUSES = "All statuses";
  var EMPTY_FILTERS = { type: "", status: "" };

  // option values, in the order of the dropdowns
  var TYPE_OPTIONS = TechnologyMapping.TYPE_ORDER.slice();
  var STATUS_OPTIONS = ["ADOPT", "TRIAL", "ASSESS", "HOLD"];

  function hasOwn(table, key) {
    return Object.prototype.hasOwnProperty.call(table, key);
  }

  function validValue(table, value) {
    return typeof value === "string" && hasOwn(table, value) ? value : "";
  }

  // keeps only known values (exact, case-sensitive); anything else means "All"
  function normalizeFilters(obj) {
    var source = obj && typeof obj === "object" ? obj : {};
    return {
      type: validValue(TechnologyMapping.TYPES, source.type),
      status: validValue(TechnologyMapping.STATUSES, source.status)
    };
  }

  // "?type=Datastores&status=HOLD" (the leading "?" is optional)
  function parseFilters(search) {
    var params = new URLSearchParams(typeof search === "string" ? search : "");
    return normalizeFilters({
      type: params.get("type"),
      status: params.get("status")
    });
  }

  // new query string for the filters, keeping every other param of currentSearch
  function buildSearch(filters, currentSearch) {
    var normalized = normalizeFilters(filters);
    var params = new URLSearchParams(typeof currentSearch === "string" ? currentSearch : "");
    ["type", "status"].forEach(function (name) {
      if (normalized[name]) {
        params.set(name, normalized[name]);
      } else {
        params.delete(name);
      }
    });
    var query = params.toString();
    return query ? "?" + query : "";
  }

  function isActive(filters) {
    var normalized = normalizeFilters(filters);
    return normalized.type !== "" || normalized.status !== "";
  }

  // row: { type, status }; both active filters must match (AND)
  function matches(row, filters) {
    var normalized = normalizeFilters(filters);
    if (normalized.type && row.type !== normalized.type) return false;
    if (normalized.status && row.status !== normalized.status) return false;
    return true;
  }

  function countMatches(rows, filters) {
    var normalized = normalizeFilters(filters);
    return rows.filter(function (row) {
      return matches(row, normalized);
    }).length;
  }

  return {
    ALL_TYPES: ALL_TYPES,
    ALL_STATUSES: ALL_STATUSES,
    EMPTY_FILTERS: EMPTY_FILTERS,
    TYPE_OPTIONS: TYPE_OPTIONS,
    STATUS_OPTIONS: STATUS_OPTIONS,
    normalizeFilters: normalizeFilters,
    parseFilters: parseFilters,
    buildSearch: buildSearch,
    isActive: isActive,
    matches: matches,
    countMatches: countMatches
  };
}));
