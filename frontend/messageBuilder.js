(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.DonationMessageBuilder = factory();
  }
}(typeof self !== "undefined" ? self : this, function () {

  // ─── Primitives ────────────────────────────────────────────────────────────

  function clean(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function bold(text) {
    var value = clean(text);
    return value ? "*" + value + "*" : "";
  }

  var SEPARATOR = "--------------------------------------------";
  var SEPARATOR_HEADER = "➖➖➖--------------------------------";

  // ─── centerLine(text, type) ────────────────────────────────────────────────
  // Lightweight visual centering via small left-padding.
  // Works on WhatsApp mobile (proportional font) without causing word-wrap.
  //
  // type controls the reference width used for padding calculation:
  //   "header"   → 42  (trust name, devotional greeting)
  //   "location" → 44  (city/location — slightly wider target)
  //   "donor"    → 38  (donor name lines)
  //   "body"     → 36  (occasion lines, "द्वारा..." line)
  //   "footer"   → 38  (slogans, thank-you)
  //   "normal"   → 36  (default)
  //
  // Max padding: 12 spaces. Never pads lines longer than 38 visible chars.
  //
  // Visible length strips: * markers, emojis, leading/trailing whitespace.

  var NEVER_PAD_ABOVE = 38;   // lines longer than this are left-aligned
  var MAX_PAD         = 12;
  var LOCATION_EXTRA  = 10;   // extra indent for location line to visually
                               // center it under the wider trust name above

  var TYPE_WIDTH = {
    header:   42,
    location: 44,
    donor:    38,
    body:     36,
    footer:   38,
    normal:   36,
  };

  // Emoji regex — covers all common Unicode emoji blocks.
  var EMOJI_RE = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FEFF}]/gu;

  function visibleLength(text) {
    return text
      .replace(/\*/g, "")        // strip bold markers
      .replace(EMOJI_RE, "  ")   // each emoji ≈ 2 chars wide
      .trim()
      .length;
  }

  function centerLine(text, type) {
    var value = clean(text);
    if (!value) return value;
    var vlen = visibleLength(value);
    if (vlen > NEVER_PAD_ABOVE) return value;
    var refWidth = TYPE_WIDTH[type] || TYPE_WIDTH.normal;
    var pad = Math.min(Math.floor((refWidth - vlen) / 2), MAX_PAD);
    // Location line gets extra indent to visually align under the trust name.
    if (type === "location") {
      pad = Math.min(pad + LOCATION_EXTRA, MAX_PAD + LOCATION_EXTRA);
    }
    return pad > 0 ? " ".repeat(pad) + value : value;
  }

  // ─── Name helpers ──────────────────────────────────────────────────────────

  // Strip trailing "Family" (any case) so "Batra Family" → "Batra परिवार".
  function normalizeFamilyName(name) {
    return clean(name).replace(/\s+family\s*$/i, "").trim();
  }

  // ─── Donor helpers ─────────────────────────────────────────────────────────

  function normalizeDonors(donors) {
    if (!Array.isArray(donors)) return [];
    return donors
      .map(function (d) {
        return { name: clean(d && d.name), relation: clean(d && d.relation) };
      })
      .filter(function (d) { return d.name; });
  }

  function translateRelation(relation) {
    var value = clean(relation);
    if (!value) return "";
    var map = {
      father: "पिता", mother: "माता",
      son: "पुत्र",   daughter: "पुत्री",
      husband: "पति", wife: "पत्नी",
    };
    var translated = map[value.toLowerCase()];
    if (translated) return translated;
    if (/^[a-z\s]+$/i.test(value)) return "";
    return value;
  }

  // Public helper: bold name + optional relation in parens.
  function formatDonor(donor, includeRelation) {
    var name = clean(donor && donor.name);
    if (!name) return "";
    var label = bold(name);
    if (!includeRelation) return label;
    var rel = translateRelation(donor && donor.relation);
    return rel ? label + " (" + rel + ")" : label;
  }

  // Public helper: join multiple donors into one string.
  function formatDonors(donors, includeRelation) {
    var list = normalizeDonors(donors)
      .map(function (d) { return formatDonor(d, includeRelation); })
      .filter(Boolean);
    if (list.length === 0) return "";
    if (list.length === 1) return list[0];
    if (list.length === 2) return list[0] + " एवं " + list[1];
    return list.slice(0, -1).join(", ") + " एवं " + list[list.length - 1];
  }

  // "🔸 *Name*, City"  or  "🔸 *Name*"  when city absent.
  function formatDonorWithCity(donorName, city) {
    var name = clean(donorName);
    if (!name) return "";
    var cityPart = clean(city);
    return "🔸 " + bold(name) + (cityPart ? ", " + cityPart : "");
  }

  // ─── Post-type helpers ─────────────────────────────────────────────────────

  function getPunyatithiText(count) {
    var numeric = parseInt(clean(count), 10);
    if (!Number.isFinite(numeric)) return "";
    return numeric + "वीं पुण्यतिथि";
  }

  function normalizePostType(postType) {
    var value = clean(postType);
    return value === "Punyatithi" ? "Punyathithi" : value;
  }

  function getOccasionLine(postType) {
    switch (normalizePostType(postType)) {
      case "Birthday":    return "के जन्मदिन के शुभ अवसर पर 🎂";
      case "Anniversary": return "की सालगिरह के शुभ अवसर पर 💐";
      case "Punyathithi": return "की पुण्यतिथि पर 🙏";
      default:            return "";
    }
  }

  function getDonationLine(donationType) {
    var value = clean(donationType);
    if (!value) return "";
    if (value.indexOf("एक समय") !== -1)  return bold("एक समय") + " का " + bold("गौ-आहार") + " प्रदान कर्ता है :-";
    if (value.indexOf("पूरे दिन") !== -1) return bold("पूरे दिन") + " का " + bold("गौ-आहार") + " प्रदान कर्ता है :-";
    if (value.indexOf("2 दिन") !== -1)    return bold("2 दिन") + " का " + bold("गौ-आहार") + " प्रदान कर्ता है :-";
    return value + " प्रदान कर्ता है :-";
  }

  // Legacy shim — kept so any external callers don't break.
  function centerText(text, type) { return centerLine(clean(text), type); }
  function buildDonorLine(donorName) {
    var name = clean(donorName);
    return name ? bold(name) + " द्वारा प्रदान किया जा रहा है" : "";
  }

  // ─── Message builder ───────────────────────────────────────────────────────

  function generateMessage(data) {
    // Custom template: return verbatim.
    var fullMessage = clean(data && data.fullMessage);
    if (fullMessage) return fullMessage;

    var postType       = normalizePostType(data && data.postType);
    var donationType   = clean(data && data.donationType);
    var donationLine   = getDonationLine(donationType);
    var mainPersonName = clean(data && data.mainPersonName);
    var occasionText   = clean(data && data.occasion);
    var location       = clean(data && data.location);
    var customMessage  = clean(data && data.customMessage);
    var count          = clean(data && data.count);
    var familyName     = normalizeFamilyName(data && data.familyName);
    var donors         = normalizeDonors(data && data.donors);

    var occasionLine = postType === "Other Occasion"
      ? (occasionText ? "के " + bold(occasionText) + " के शुभ अवसर पर" : "")
      : getOccasionLine(postType);

    // ── Line buffer helpers ────────────────────────────────────────────────

    var lines = [];

    function addLine(text) {
      var value = typeof text === "string" ? text.replace(/\s+$/, "") : "";
      lines.push(value);
    }

    // addCentered: pass type for line-sensitive padding.
    function addCentered(text, type) {
      addLine(centerLine(text, type || "normal"));
    }

    function addGap() {
      // Never add two consecutive blank lines.
      if (lines.length > 0 && lines[lines.length - 1] !== "") {
        lines.push("");
      }
    }

    function addSeparator() {
      // No blank lines before or after — separator sits directly between sections.
      lines.push(SEPARATOR);
    }

    // ── 1. Header ─────────────────────────────────────────────────────────
    addCentered(bold("जय जिनेंद्र 🙏 राम राम 🙏 जय गो माता"), "header");
    addCentered(bold("🔶 उज्जवल गौशाला ट्रस्ट 🔶"), "header");
    addCentered(bold("मुजबी, भंडारा"), "location");
    lines.push(SEPARATOR);

    // ── 2. Donation title ─────────────────────────────────────────────────
    if (donationLine) {
      addCentered(donationLine, "body");
      lines.push(SEPARATOR_HEADER);
    }

    // ── 3+4. Donor + person block ─────────────────────────────────────────
    // For Birthday: Donor → occasion line → Birthday person
    // For all others: Person → occasion line → Donor(s)
    var isBirthday = postType === "Birthday";

    if (isBirthday) {
      // Donor(s) first
      if (donors.length > 0) {
        donors.forEach(function (donor, i) {
          if (i > 0) addLine("");
          addCentered(formatDonorWithCity(donor.name, location), "donor");
          addCentered("द्वारा प्रदान किया जा रहा है।", "body");
        });
      }
      // Then birthday person + occasion
      if (mainPersonName) {
        if (count) addCentered("🔸 " + bold(count), "donor");
        addCentered("🔸 " + bold(mainPersonName), "donor");
        if (occasionLine) addCentered(occasionLine, "body");
      }
    } else {
      // All other types: person + occasion first, then donor(s)
      if (mainPersonName) {
        if (count) addCentered("🔸 " + bold(count), "donor");
        addCentered("🔸 " + bold(mainPersonName), "donor");
        if (occasionLine) addCentered(occasionLine, "body");
      } else if (occasionLine) {
        addCentered(occasionLine, "body");
      }
      if (donors.length > 0) {
        donors.forEach(function (donor, i) {
          if (i > 0) addLine("");
          addCentered(formatDonorWithCity(donor.name, location), "donor");
          addCentered("द्वारा प्रदान किया जा रहा है।", "body");
        });
      }
    }

    // ── 5. Custom message ─────────────────────────────────────────────────
    if (customMessage) {
      addSeparator();
      customMessage.split("\n").forEach(function (line) {
        addLine(line.replace(/\s+$/, ""));
      });
    }

    // ── 6. Thank-you footer ───────────────────────────────────────────────
    addSeparator();
    if (familyName) {
      addCentered(bold(familyName + " परिवार") + " की जीव-दया की भावना के लिए बहोत बहोत धन्यवाद🙏", "footer");
    }
    addSeparator();
    addCentered(bold("आप की गो-सेवा अनुकरणीय है 🙏"), "footer");
    addCentered(bold("सराहनीय है 🙂"), "footer");
    addSeparator();
    addCentered(bold("गो सेवा है प्रभु सेवा 🔅 जीव-दया है श्रेष्ठ दान"), "footer");

    return lines.join("\n").replace(/[ \t]+$/gm, "").trim();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  return {
    generateMessage:     generateMessage,
    normalizeDonors:     normalizeDonors,
    normalizeFamilyName: normalizeFamilyName,
    formatDonors:        formatDonors,
    formatDonorWithCity: formatDonorWithCity,
    getPunyatithiText:   getPunyatithiText,
    getOccasionLine:     getOccasionLine,
    getDonationLine:     getDonationLine,
    buildDonorLine:      buildDonorLine,
    centerText:          centerText,
    centerLine:          centerLine,
  };
}));
