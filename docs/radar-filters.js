// Type / Status filters of the radar header. Pure logic, shared by the
// browser and the tests: option lists, URL query-string parsing and
// building, and the matching of a technology row against the filters.
(function (root, factory) {
  var mapping = (typeof module === "object" && module.exports)
    ? require("./technology-mapping.js")
    : root.TechnologyMapping;
  var filters = factory(mapping);
  if (typeof module === "object" && module.exports) {
    module.exports = filters;
  } else {
    root.RadarFilters = filters;
  }
}(typeof self !== "undefined" ? self : this, function (mapping) {
  // value of a filter that lets everything through
  var ALL = "";

  var TYPE_OPTIONS = mapping.TYPE_ORDER.slice();
  var STATUS_OPTIONS = Object.keys(mapping.STATUSES);

  function hasOwn(table, key) {
    return Object.prototype.hasOwnProperty.call(table, key);
  }

  function knownValue(table, value) {
    return typeof value === "string" && hasOwn(table, value) ? value : ALL;
  }

  // Keeps only exact, known values; anything else becomes ALL.
  function normalizeFilters(raw) {
    var source = raw && typeof raw === "object" ? raw : {};
    return {
      type: knownValue(mapping.TYPES, source.type),
      status: knownValue(mapping.STATUSES, source.status)
    };
  }

  // `search` is a location.search style string, with or without the leading "?".
  function parseFilters(search) {
    var params = new URLSearchParams(typeof search === "string" ? search : "");
    return normalizeFilters({
      type: params.get("type"),
      status: params.get("status")
    });
  }

  // Sets or removes only `type` and `status` in `search`, so other
  // parameters are kept. Returns "" or a string starting with "?".
  function buildSearch(search, filters) {
    var params = new URLSearchParams(typeof search === "string" ? search : "");
    var clean = normalizeFilters(filters);
    ["type", "status"].forEach(function (name) {
      if (clean[name] === ALL) {
        params.delete(name);
      } else {
        params.set(name, clean[name]);
      }
    });
    var query = params.toString();
    return query ? "?" + query : "";
  }

  function isActive(filters) {
    var clean = normalizeFilters(filters);
    return clean.type !== ALL || clean.status !== ALL;
  }

  // AND of both filters; ALL matches everything.
  function matches(row, filters) {
    var clean = normalizeFilters(filters);
    return (clean.type === ALL || row.type === clean.type) &&
      (clean.status === ALL || row.status === clean.status);
  }

  function countMatching(rows, filters) {
    var clean = normalizeFilters(filters);
    return rows.filter(function (row) {
      return matches(row, clean);
    }).length;
  }

  function summary(shown, total) {
    return "Showing " + shown + " of " + total + " technologies";
  }

  return {
    ALL: ALL,
    TYPE_OPTIONS: TYPE_OPTIONS,
    STATUS_OPTIONS: STATUS_OPTIONS,
    normalizeFilters: normalizeFilters,
    parseFilters: parseFilters,
    buildSearch: buildSearch,
    isActive: isActive,
    matches: matches,
    countMatching: countMatching,
    summary: summary
  };
}));
