// Pure logic for the Type / Status filters of the page header: option lists,
// URL query string parsing and serialization, matching and counting.
// Shared by the browser and the tests; it never touches the DOM.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./technology-mapping.js"));
  } else {
    root.TechnologyFilters = factory(root.TechnologyMapping);
  }
}(typeof self !== "undefined" ? self : this, function (TechnologyMapping) {
  // value of a filter that lets everything through
  var ALL = "";

  var TYPE_OPTIONS = TechnologyMapping.TYPE_ORDER.slice();
  var STATUS_OPTIONS = Object.keys(TechnologyMapping.STATUSES);

  var PARAMS = { type: "type", status: "status" };

  function pick(options, value) {
    return typeof value === "string" && options.indexOf(value) !== -1 ? value : ALL;
  }

  // Keep a value only when it is a known option (exact match), else "All".
  function normalizeFilters(filters) {
    var source = filters || {};
    return {
      type: pick(TYPE_OPTIONS, source.type),
      status: pick(STATUS_OPTIONS, source.status)
    };
  }

  // Read the filters from a query string such as "?type=Datastores&status=HOLD".
  // Each parameter is handled on its own: an unknown value only resets itself.
  function parseFilters(search) {
    var params = new URLSearchParams(typeof search === "string" ? search : "");
    return normalizeFilters({
      type: params.get(PARAMS.type),
      status: params.get(PARAMS.status)
    });
  }

  // Return a query string (with a leading "?", or "" when empty) that carries
  // the filters and keeps every other parameter of `search`.
  function serializeFilters(filters, search) {
    var normalized = normalizeFilters(filters);
    var params = new URLSearchParams(typeof search === "string" ? search : "");
    Object.keys(PARAMS).forEach(function (key) {
      params.delete(PARAMS[key]);
      if (normalized[key] !== ALL) {
        params.set(PARAMS[key], normalized[key]);
      }
    });
    var query = params.toString();
    return query ? "?" + query : "";
  }

  // Full relative URL for history.replaceState().
  function buildUrl(filters, location) {
    return location.pathname + serializeFilters(filters, location.search) + (location.hash || "");
  }

  function matches(tech, filters) {
    var normalized = normalizeFilters(filters);
    return (normalized.type === ALL || tech.type === normalized.type) &&
      (normalized.status === ALL || tech.status === normalized.status);
  }

  function countMatches(list, filters) {
    var shown = 0;
    list.forEach(function (tech) {
      if (matches(tech, filters)) shown++;
    });
    return { shown: shown, total: list.length };
  }

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
    buildUrl: buildUrl,
    matches: matches,
    countMatches: countMatches,
    isActive: isActive,
    counterText: counterText
  };
}));
