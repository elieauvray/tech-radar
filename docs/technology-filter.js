// Pure logic behind the Type / Status filters of the page header: option
// lists, URL (?type=&status=) parsing and building, and matching.
// No DOM access, so it can be unit-tested with node.
(function (root, factory) {
  var filter = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = filter;
  } else {
    root.TechnologyFilter = filter;
  }
}(typeof self !== "undefined" ? self : this, function () {
  // "All" is represented by the empty string (the value of the first
  // <option> of each dropdown).
  var ALL = "";

  // Kept in sync with TechnologyMapping.TYPE_ORDER / STATUSES keys by a test.
  var TYPE_OPTIONS = ["Datastores", "Data Management", "Infrastructure", "Language"];
  var STATUS_OPTIONS = ["ADOPT", "TRIAL", "ASSESS", "HOLD"];

  function sanitize(value, options) {
    return typeof value === "string" && options.indexOf(value) !== -1 ? value : ALL;
  }

  function normalize(filters) {
    var f = filters || {};
    return {
      type: sanitize(f.type, TYPE_OPTIONS),
      status: sanitize(f.status, STATUS_OPTIONS)
    };
  }

  function toParams(search) {
    return new URLSearchParams(typeof search === "string" ? search : "");
  }

  // Reads the filters from a query string such as `location.search`.
  // Unknown, empty or missing values become ALL; the first value wins
  // when a parameter is repeated.
  function parseFilters(search) {
    var params = toParams(search);
    return {
      type: sanitize(params.get("type"), TYPE_OPTIONS),
      status: sanitize(params.get("status"), STATUS_OPTIONS)
    };
  }

  // Returns the query string ("?a=b" or "") with `type` and `status` set or
  // removed according to `filters`; other parameters are preserved.
  function buildSearch(filters, currentSearch) {
    var f = normalize(filters);
    var params = toParams(currentSearch);
    if (f.type === ALL) {
      params.delete("type");
    } else {
      params.set("type", f.type);
    }
    if (f.status === ALL) {
      params.delete("status");
    } else {
      params.set("status", f.status);
    }
    var query = params.toString();
    return query ? "?" + query : "";
  }

  function matches(tech, filters) {
    var f = filters || {};
    var typeOk = !f.type || f.type === ALL || tech.type === f.type;
    var statusOk = !f.status || f.status === ALL || tech.status === f.status;
    return typeOk && statusOk;
  }

  function countMatching(list, filters) {
    var count = 0;
    (list || []).forEach(function (tech) {
      if (matches(tech, filters)) count++;
    });
    return count;
  }

  function isActive(filters) {
    var f = normalize(filters);
    return f.type !== ALL || f.status !== ALL;
  }

  function counterText(n, m) {
    return "Showing " + n + " of " + m + " technologies";
  }

  return {
    ALL: ALL,
    TYPE_OPTIONS: TYPE_OPTIONS,
    STATUS_OPTIONS: STATUS_OPTIONS,
    parseFilters: parseFilters,
    buildSearch: buildSearch,
    matches: matches,
    countMatching: countMatching,
    isActive: isActive,
    counterText: counterText
  };
}));
