// Pure logic for the Type / Status filters of the radar header: value
// validation, URL query string round trip, matching and counter text.
// Shared by the browser and the tests.
(function (root, factory) {
  var mapping = (typeof module === "object" && module.exports)
    ? require("./technology-mapping.js")
    : root.TechnologyMapping;
  var filters = factory(mapping);
  if (typeof module === "object" && module.exports) {
    module.exports = filters;
  } else {
    root.TechnologyFilters = filters;
  }
}(typeof self !== "undefined" ? self : this, function (mapping) {
  // The empty string stands for "All types" / "All statuses".
  var ALL = "";

  var TYPE_OPTIONS = ["Datastores", "Data Management", "Infrastructure", "Language"];
  var STATUS_OPTIONS = ["ADOPT", "TRIAL", "ASSESS", "HOLD"];

  function isKnown(table, value) {
    return typeof value === "string" &&
      Object.prototype.hasOwnProperty.call(table, value);
  }

  // Keeps a value only when it is an exact, known Type / Status.
  function normalizeFilters(filters) {
    var source = filters || {};
    return {
      type: isKnown(mapping.TYPES, source.type) ? source.type : ALL,
      status: isKnown(mapping.STATUSES, source.status) ? source.status : ALL
    };
  }

  // `search` is a query string such as "?type=Datastores&status=HOLD".
  function parseFilters(search) {
    var params = new URLSearchParams(typeof search === "string" ? search : "");
    return normalizeFilters({
      type: params.get("type"),
      status: params.get("status")
    });
  }

  // Returns the query string (with a leading "?", or "" when empty) for the
  // given filters, keeping every unrelated param of `currentSearch`.
  function buildSearch(filters, currentSearch) {
    var normalized = normalizeFilters(filters);
    var params = new URLSearchParams(typeof currentSearch === "string" ? currentSearch : "");
    ["type", "status"].forEach(function (key) {
      if (normalized[key] === ALL) {
        params.delete(key);
      } else {
        params.set(key, normalized[key]);
      }
    });
    var query = params.toString();
    return query ? "?" + query : "";
  }

  function isActive(filters) {
    var normalized = normalizeFilters(filters);
    return normalized.type !== ALL || normalized.status !== ALL;
  }

  // AND of both filters; "All" matches anything.
  function matches(tech, filters) {
    var normalized = normalizeFilters(filters);
    if (normalized.type !== ALL && tech.type !== normalized.type) return false;
    if (normalized.status !== ALL && tech.status !== normalized.status) return false;
    return true;
  }

  function countMatching(technologies, filters) {
    var normalized = normalizeFilters(filters);
    return technologies.filter(function (tech) {
      return matches(tech, normalized);
    }).length;
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
    buildSearch: buildSearch,
    isActive: isActive,
    matches: matches,
    countMatching: countMatching,
    counterText: counterText
  };
}));
