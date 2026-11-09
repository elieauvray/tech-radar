// Type and Status filters of the radar page. Pure logic (no DOM), shared by
// the browser (window.TechnologyFilter) and the tests. A filter value is
// either ALL ("") or one of the domain values of TechnologyMapping; anything
// else, such as an unknown value in the URL, is treated as ALL.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./technology-mapping.js"));
  } else {
    root.TechnologyFilter = factory(root.TechnologyMapping);
  }
}(typeof self !== "undefined" ? self : this, function (TechnologyMapping) {
  var ALL = "";
  var TYPE_OPTIONS = TechnologyMapping.TYPE_ORDER.slice();
  var STATUS_OPTIONS = Object.keys(TechnologyMapping.STATUSES);

  // Exact, case-sensitive match against the allowed values: inherited
  // property names such as "toString" or "__proto__" are not in the list.
  function normalizeValue(value, options) {
    return typeof value === "string" && options.indexOf(value) !== -1 ? value : ALL;
  }

  // Returns a fresh { type, status } where every unknown value is ALL.
  function normalizeFilters(filters) {
    var input = filters !== null && typeof filters === "object" ? filters : {};
    var own = function (key) {
      return Object.prototype.hasOwnProperty.call(input, key) ? input[key] : ALL;
    };
    return {
      type: normalizeValue(own("type"), TYPE_OPTIONS),
      status: normalizeValue(own("status"), STATUS_OPTIONS)
    };
  }

  // One parameter of a query string; a missing or repeated one is ALL.
  function singleParam(params, name) {
    var values = params.getAll(name);
    return values.length === 1 ? values[0] : ALL;
  }

  // Filters from a query string such as "?type=Datastores&status=HOLD".
  function parseFilters(search) {
    var params = new URLSearchParams(typeof search === "string" ? search : "");
    return normalizeFilters({
      type: singleParam(params, "type"),
      status: singleParam(params, "status")
    });
  }

  // "" when no filter is set, else "?type=...&status=..." with only the set filters.
  function serializeFilters(filters) {
    var normalized = normalizeFilters(filters);
    var params = new URLSearchParams();
    if (normalized.type !== ALL) params.set("type", normalized.type);
    if (normalized.status !== ALL) params.set("status", normalized.status);
    var query = params.toString();
    return query ? "?" + query : "";
  }

  // `item` has a `type` and a `status`; both filters must accept it (AND).
  function matches(item, filters) {
    var normalized = normalizeFilters(filters);
    return (normalized.type === ALL || item.type === normalized.type) &&
      (normalized.status === ALL || item.status === normalized.status);
  }

  function countMatching(rows, filters) {
    var count = 0;
    for (var i = 0; i < rows.length; i++) {
      if (matches(rows[i], filters)) count++;
    }
    return count;
  }

  // True when at least one filter is not ALL.
  function isActive(filters) {
    var normalized = normalizeFilters(filters);
    return normalized.type !== ALL || normalized.status !== ALL;
  }

  function counterText(shown, total) {
    return "Showing " + shown + " of " + total + " technologies";
  }

  return {
    ALL: ALL,
    TYPE_OPTIONS: TYPE_OPTIONS,
    STATUS_OPTIONS: STATUS_OPTIONS,
    normalizeFilters: normalizeFilters,
    parseFilters: parseFilters,
    serializeFilters: serializeFilters,
    matches: matches,
    countMatching: countMatching,
    isActive: isActive,
    counterText: counterText
  };
}));
