// Pure filter rules for the Type / Status dropdowns of the radar header.
// Shared by the browser and the tests; it knows nothing about the DOM.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./technology-mapping.js"));
  } else {
    root.TechnologyFilter = factory(root.TechnologyMapping);
  }
}(typeof self !== "undefined" ? self : this, function (TechnologyMapping) {
  // The empty string means "All" (no filtering on that field).
  var ALL = "";
  var TYPE_OPTIONS = TechnologyMapping.TYPE_ORDER.slice();
  var STATUS_OPTIONS = Object.keys(TechnologyMapping.STATUSES);

  // Returns the value when it is exactly one of the options, ALL otherwise.
  // Anything else (wrong case, non-string, "__proto__", "toString"...) is
  // rejected because indexOf only matches the listed strings.
  function normalizeValue(value, options) {
    return typeof value === "string" && options.indexOf(value) !== -1 ? value : ALL;
  }

  function normalizeFilters(filters) {
    var input = filters !== null && typeof filters === "object" ? filters : {};
    var type = Object.prototype.hasOwnProperty.call(input, "type") ? input.type : ALL;
    var status = Object.prototype.hasOwnProperty.call(input, "status") ? input.status : ALL;
    return {
      type: normalizeValue(type, TYPE_OPTIONS),
      status: normalizeValue(status, STATUS_OPTIONS)
    };
  }

  // Reads ?type=...&status=... from a query string. The first occurrence of
  // a parameter wins; unknown values fall back to ALL.
  function parseFilters(search) {
    var params = new URLSearchParams(typeof search === "string" ? search : "");
    var type = params.get("type");
    var status = params.get("status");
    return normalizeFilters({
      type: type === null ? ALL : type,
      status: status === null ? ALL : status
    });
  }

  function isActive(filters) {
    var normalized = normalizeFilters(filters);
    return normalized.type !== ALL || normalized.status !== ALL;
  }

  // Returns a query string ("?a=b" or "") where only type/status are set or
  // removed; any other parameter of currentSearch is preserved.
  function buildSearch(filters, currentSearch) {
    var normalized = normalizeFilters(filters);
    var params = new URLSearchParams(typeof currentSearch === "string" ? currentSearch : "");
    params.delete("type");
    params.delete("status");
    if (normalized.type !== ALL) params.set("type", normalized.type);
    if (normalized.status !== ALL) params.set("status", normalized.status);
    var query = params.toString();
    return query === "" ? "" : "?" + query;
  }

  // item has { type, status }; both filters must match (AND).
  function matches(item, filters) {
    var normalized = normalizeFilters(filters);
    var typeOk = normalized.type === ALL || (item !== null && item !== undefined && item.type === normalized.type);
    var statusOk = normalized.status === ALL || (item !== null && item !== undefined && item.status === normalized.status);
    return typeOk && statusOk;
  }

  function countMatching(rows, filters) {
    var normalized = normalizeFilters(filters);
    return rows.filter(function (row) {
      return matches(row, normalized);
    }).length;
  }

  return {
    ALL: ALL,
    TYPE_OPTIONS: TYPE_OPTIONS,
    STATUS_OPTIONS: STATUS_OPTIONS,
    normalizeFilters: normalizeFilters,
    parseFilters: parseFilters,
    buildSearch: buildSearch,
    matches: matches,
    countMatching: countMatching,
    isActive: isActive
  };
}));
