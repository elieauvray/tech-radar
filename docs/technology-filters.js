// Pure helpers for the Type / Status filters of the radar header: option
// lists, URL (query string) parsing and serialising, and matching. Shared by
// the browser and the tests; no DOM access here.
(function (root, factory) {
  var filters = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = filters;
  } else {
    root.TechnologyFilters = filters;
  }
}(typeof self !== "undefined" ? self : this, function () {
  // Value of the "All types" / "All statuses" options: no constraint.
  var ALL = "";

  var TYPE_OPTIONS = ["Datastores", "Data Management", "Infrastructure", "Language"];
  var STATUS_OPTIONS = ["ADOPT", "TRIAL", "ASSESS", "HOLD"];

  function pick(value, allowed) {
    return typeof value === "string" && allowed.indexOf(value) !== -1 ? value : ALL;
  }

  // Any value that is not an allowed option (unknown, wrong case,
  // non-string, missing) becomes ALL.
  function normalizeFilters(filters) {
    var source = filters || {};
    return {
      type: pick(source.type, TYPE_OPTIONS),
      status: pick(source.status, STATUS_OPTIONS)
    };
  }

  // Reads `type` and `status` from a query string such as "?type=Datastores".
  // Other params are ignored; for repeated params the first one wins.
  function parseFilters(search) {
    var params = new URLSearchParams(typeof search === "string" ? search : "");
    return normalizeFilters({
      type: params.get("type"),
      status: params.get("status")
    });
  }

  // Returns "" when no filter is active, otherwise "?type=...&status=...".
  function serializeFilters(filters) {
    var normalized = normalizeFilters(filters);
    var params = new URLSearchParams();
    if (normalized.type !== ALL) params.set("type", normalized.type);
    if (normalized.status !== ALL) params.set("status", normalized.status);
    var query = params.toString();
    return query ? "?" + query : "";
  }

  function isActive(filters) {
    var normalized = normalizeFilters(filters);
    return normalized.type !== ALL || normalized.status !== ALL;
  }

  // AND of both filters on a row with `type` and `status`.
  function matches(tech, filters) {
    var normalized = normalizeFilters(filters);
    if (normalized.type !== ALL && tech.type !== normalized.type) return false;
    if (normalized.status !== ALL && tech.status !== normalized.status) return false;
    return true;
  }

  function countMatching(list, filters) {
    var count = 0;
    (list || []).forEach(function (tech) {
      if (matches(tech, filters)) count += 1;
    });
    return count;
  }

  return {
    ALL: ALL,
    TYPE_OPTIONS: TYPE_OPTIONS,
    STATUS_OPTIONS: STATUS_OPTIONS,
    normalizeFilters: normalizeFilters,
    parseFilters: parseFilters,
    serializeFilters: serializeFilters,
    isActive: isActive,
    matches: matches,
    countMatching: countMatching
  };
}));
