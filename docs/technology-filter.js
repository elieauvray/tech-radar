// Pure logic for the header Type / Status filters: matching, normalisation
// and (de)serialisation of the `?type=…&status=…` query string. An empty
// string means "All". Shared by the browser and the tests.
(function (root, factory) {
  var mapping = (typeof module === "object" && module.exports)
    ? require("./technology-mapping.js")
    : root.TechnologyMapping;
  var filter = factory(mapping);
  if (typeof module === "object" && module.exports) {
    module.exports = filter;
  } else {
    root.TechnologyFilter = filter;
  }
}(typeof self !== "undefined" ? self : this, function (mapping) {
  var DEFAULT_FILTERS = { type: "", status: "" };

  function hasOwn(table, key) {
    return typeof key === "string" && Object.prototype.hasOwnProperty.call(table, key);
  }

  function pick(table, value) {
    return hasOwn(table, value) ? value : "";
  }

  // Keeps only known values (exact, case-sensitive); anything else is "All".
  function normalizeFilters(input) {
    var source = input && typeof input === "object" ? input : {};
    return {
      type: pick(mapping.TYPES, source.type),
      status: pick(mapping.STATUSES, source.status)
    };
  }

  function parseQuery(search) {
    var params = new URLSearchParams(typeof search === "string" ? search : "");
    return normalizeFilters({
      type: params.get("type"),
      status: params.get("status")
    });
  }

  function isActive(filters) {
    var f = normalizeFilters(filters);
    return f.type !== "" || f.status !== "";
  }

  function toQuery(filters) {
    var f = normalizeFilters(filters);
    var params = new URLSearchParams();
    if (f.type) params.set("type", f.type);
    if (f.status) params.set("status", f.status);
    var query = params.toString();
    return query ? "?" + query : "";
  }

  function matches(row, filters) {
    var f = normalizeFilters(filters);
    if (f.type && (!row || row.type !== f.type)) return false;
    if (f.status && (!row || row.status !== f.status)) return false;
    return true;
  }

  function countMatching(rows, filters) {
    var f = normalizeFilters(filters);
    return (rows || []).filter(function (row) {
      return matches(row, f);
    }).length;
  }

  return {
    DEFAULT_FILTERS: DEFAULT_FILTERS,
    normalizeFilters: normalizeFilters,
    parseQuery: parseQuery,
    toQuery: toQuery,
    isActive: isActive,
    matches: matches,
    countMatching: countMatching
  };
}));
