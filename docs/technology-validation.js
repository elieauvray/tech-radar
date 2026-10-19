// Validation rules for a technology submitted from the "Add a technology"
// form. Shared by the browser (client-side checks) and the server
// (POST /api/technologies) so both apply exactly the same rules.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./technology-mapping.js"));
  } else {
    root.TechnologyValidation = factory(root.TechnologyMapping);
  }
}(typeof self !== "undefined" ? self : this, function (TechnologyMapping) {
  var TITLE_MAX = 60;
  var DESCRIPTION_MAX = 280;

  // Length in Unicode code points, to match PostgreSQL char_length().
  function length(value) {
    return Array.from(value).length;
  }

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function validateText(body, field, label, max, value, errors) {
    var raw = body[field];
    var text = typeof raw === "string" ? raw.trim() : "";
    if (text.length === 0) {
      errors[field] = label + " is required";
    } else if (length(text) > max) {
      errors[field] = label + " must be at most " + max + " characters";
    } else {
      value[field] = text;
    }
  }

  function validateChoice(body, field, label, table, value, errors) {
    var raw = body[field];
    if (typeof raw === "string" && Object.prototype.hasOwnProperty.call(table, raw)) {
      value[field] = raw;
    } else {
      errors[field] = label + " must be one of: " + Object.keys(table).join(", ");
    }
  }

  // Returns { value, errors }. `value` only contains the five allowed fields
  // (any other key, including `number`, is dropped); `errors` maps each
  // invalid field to one message and is empty when the input is valid.
  function validateTechnology(body) {
    var input = isPlainObject(body) ? body : {};
    var value = {};
    var errors = {};
    validateText(input, "title", "Title", TITLE_MAX, value, errors);
    validateText(input, "description", "Description", DESCRIPTION_MAX, value, errors);
    validateChoice(input, "type", "Type", TechnologyMapping.TYPES, value, errors);
    validateChoice(input, "status", "Status", TechnologyMapping.STATUSES, value, errors);
    validateChoice(input, "trend", "Trend", TechnologyMapping.TRENDS, value, errors);
    return { value: value, errors: errors };
  }

  return {
    TITLE_MAX: TITLE_MAX,
    DESCRIPTION_MAX: DESCRIPTION_MAX,
    codePointLength: length,
    validateTechnology: validateTechnology
  };
}));
