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

  // Standard separator used everywhere.
  var SEP       = "----------------------------------------------------------";
  // Used ONLY after "पुरे दिन" donation line.
  var SEP_PURNA = "➖➖➖------------------------------------------";

  // ─── centerLine(text, type) ────────────────────────────────────────────────

  var NEVER_PAD_ABOVE = 38;
  var MAX_PAD         = 12;
  var LOCATION_EXTRA  = 10;

  var TYPE_WIDTH = {
    header:   42,
    location: 44,
    donor:    38,
    body:     36,
    footer:   38,
    normal:   36,
  };

  var EMOJI_RE = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FEFF}]/gu;

  function visibleLength(text) {
    return text
      .replace(/\*/g, "")
      .replace(EMOJI_RE, "  ")
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
    if (type === "location") {
      pad = Math.min(pad + LOCATION_EXTRA, MAX_PAD + LOCATION_EXTRA);
    }
    return pad > 0 ? " ".repeat(pad) + value : value;
  }

  // ─── Name helpers ──────────────────────────────────────────────────────────

  function normalizeFamilyName(name) {
    return clean(name).replace(/\s+family\s*$/i, "").trim();
  }

  // Extract surname = last word of the donor name.
  // "श्री धीरज जी प्रकाशजी गांधी" → "गांधी"
  function extractSurname(donorName) {
    var value = clean(donorName);
    if (!value) return "";
    var words = value.split(/\s+/);
    return words[words.length - 1];
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

  function formatDonor(donor, includeRelation) {
    var name = clean(donor && donor.name);
    if (!name) return "";
    var label = bold(name);
    if (!includeRelation) return label;
    var rel = translateRelation(donor && donor.relation);
    return rel ? label + " (" + rel + ")" : label;
  }

  function formatDonors(donors, includeRelation) {
    var list = normalizeDonors(donors)
      .map(function (d) { return formatDonor(d, includeRelation); })
      .filter(Boolean);
    if (list.length === 0) return "";
    if (list.length === 1) return list[0];
    if (list.length === 2) return list[0] + " एवं " + list[1];
    return list.slice(0, -1).join(", ") + " एवं " + list[list.length - 1];
  }

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
    if (value === "Punyatithi") return "Punyathithi";
    return value;
  }

  function getOccasionLine(postType) {
    switch (normalizePostType(postType)) {
      case "Birthday":    return "के जन्मदिन के शुभ अवसर पर 🎂";
      case "Anniversary": return "की सालगिरह के शुभ अवसर पर 💐";
      case "Punyathithi": return "की पुण्यतिथि पर 🙏";
      default:            return "";
    }
  }

  // Returns { line, isPurna } — isPurna drives separator choice.
  function getDonationInfo(donationType) {
    var value = clean(donationType);
    if (!value) return { line: "", isPurna: false };
    if (value.indexOf("पुरे दिन") !== -1 || value.indexOf("पूरे दिन") !== -1) {
      return {
        line: bold("पुरे दिन") + " का " + bold("गौ-आहार") + " प्रदान कर्ता है :-",
        isPurna: true,
      };
    }
    if (value.indexOf("एक समय") !== -1) {
      return {
        line: bold("एक समय") + " का " + bold("गौ-आहार") + " प्रदान कर्ता है :-",
        isPurna: false,
      };
    }
    if (value.indexOf("2 दिन") !== -1) {
      return {
        line: bold("2 दिन") + " का " + bold("गौ-आहार") + " प्रदान कर्ता है :-",
        isPurna: false,
      };
    }
    return { line: value + " प्रदान कर्ता है :-", isPurna: false };
  }

  // Legacy shim.
  function getDonationLine(donationType) {
    return getDonationInfo(donationType).line;
  }

  function centerText(text, type) { return centerLine(clean(text), type); }
  function buildDonorLine(donorName) {
    var name = clean(donorName);
    return name ? bold(name) + " द्वारा प्रदान किया जा रहा है" : "";
  }

  // ─── Message builder ───────────────────────────────────────────────────────

  function generateMessage(data) {
    var fullMessage = clean(data && data.fullMessage);
    if (fullMessage) return fullMessage;

    var postType       = normalizePostType(data && data.postType);
    var donationType   = clean(data && data.donationType);
    var donationInfo   = getDonationInfo(donationType);
    var mainPersonName = clean(data && data.mainPersonName);
    var occasionText   = clean(data && data.occasion);
    var location       = clean(data && data.location);
    var customMessage  = clean(data && data.customMessage);
    var count          = clean(data && data.count);
    var familyName     = normalizeFamilyName(data && data.familyName);
    var donors         = normalizeDonors(data && data.donors);

    var donor1 = donors.length > 0 ? donors[0] : null;
    var donorName    = donor1 ? donor1.name : "";
    var donorRelation = donor1 ? (translateRelation(donor1.relation) || clean(donor1.relation)) : "";

    // Surname for thank-you line: last word of primary donor name
    var donorSurname = extractSurname(donorName);
    var thankYouLine = bold(donorSurname + " परिवार") + " को बहोत धन्यवाद 🙏";

    // Intro line required before donor block for ALL post types
    var INTRO_LINE = "उज्ज्वल गौरक्षण के " + bold("सहयोग-दाता") + " एवं " + bold("कर्तव्यनिष्ठ गौभक्त") + " :-";

    // Classify post type
    var isPunyatithi   = postType === "Punyathithi";
    var isJanmajayanti = postType === "Anniversary" || postType === "Janmajayanti";
    var isBirthday     = postType === "Birthday";
    var isMemorial     = isPunyatithi || isJanmajayanti;

    var lines = [];

    function L(text) {
      lines.push(typeof text === "string" ? text.replace(/\s+$/, "") : "");
    }
    function C(text, type) {
      L(centerLine(text, type || "normal"));
    }
    function S() { L(SEP); }

    // ── 1. Header (always identical) ────────────────────────────────────────
    C(bold("जय जिनेंद्र 🙏राम राम 🙏जय गौ-माता"), "header");
    C("♦️ " + bold("उज्ज्वल गौरक्षण ट्रस्ट") + " ♦️", "header");
    C(bold("मुजबी, भंडारा"), "location");
    S();

    // ── 2. Donation title + separator ───────────────────────────────────────
    if (donationInfo.line) {
      C(donationInfo.line, "body");
      // "पुरे दिन" → emoji separator; "एक समय" → plain separator
      L(donationInfo.isPurna ? SEP_PURNA : SEP);
    }

    // ── 3. Body — strict templates per post type ────────────────────────────

    if (isPunyatithi) {
      L(INTRO_LINE);
      L("");
      L("🔸 " + bold(donorName));
      L("");
      L("          एवं परिवार की ओर से आदरणीय " + bold(donorRelation) + " --");
      L("");
      L("🔸 " + bold(mainPersonName || count));
      L("");
      L("             की 🙏" + bold("पुण्यतिथि") + "🙏");
      L("");
      L("के अवसर पर " + bold("गौ-आहार") + " 🌾🌾, सभी गौवंश को प्रदान किया जा रहा है।");
      L("");
      L("उज्ज्वल गौरक्षण टीम की ओर से हम " + bold("श्रद्धांजलि अर्पित") + " करते हैं 🙏");
      L("");
      L(thankYouLine);

    } else if (isJanmajayanti) {
      L(INTRO_LINE);
      L("");
      L("🔸 " + bold(donorName));
      L("");
      L("          एवं परिवार की ओर से आदरणीय " + bold(donorRelation) + " --");
      L("");
      L("🔸 " + bold(mainPersonName || count));
      L("");
      L("             के🙏 " + bold("जन्मजयंती") + " 🙏");
      L("");
      L("के अवसर पर " + bold("गौ-आहार") + " 🌾🌾, सभी गौवंश को प्रदान किया जा रहा है।");
      L("");
      L("उज्ज्वल गौरक्षण टीम की ओर से हम " + bold("श्रद्धांजलि अर्पित") + " करते हैं 🙏");
      L("");
      L(thankYouLine);

    } else if (isBirthday) {
      var nameParts = mainPersonName
        ? mainPersonName.replace(/^\s*श्री\s+/, "").split(/\s+/)
        : [];
      var nameWithHonorific = nameParts.length >= 2
        ? nameParts[0] + " " + nameParts[1]
        : (nameParts[0] || "");
      L(INTRO_LINE);
      L("");
      L("🔸 " + bold(donorName));
      L("");
      L("          एवं परिवार की ओर से " + bold(donorRelation) + " --");
      L("");
      L("🔸 " + bold(mainPersonName));
      L("");
      L("             के " + bold("जन्म दिवस") + " 🍨💐");
      L("");
      L("के अवसर पर " + bold("गौ-आहार") + " 🌾🌾, सभी गौवंश को प्रदान किया जा रहा है।");
      L("");
      L("उज्ज्वल गौरक्षण टीम की ओर से " + bold(nameWithHonorific) + " को बहोत‌ " + bold("बधाई") + " 💐 एवं " + bold("खुशहाल") + " " + bold("धर्म मय") + " " + bold("जिवन") + " की " + bold("शुभकामनाएं") + " ।🙂");
      L("");
      L(thankYouLine);

    } else {
      // General Donation / Other
      L(INTRO_LINE);
      if (mainPersonName) {
        if (count) C("🔸 " + bold(count), "donor");
        C("🔸 " + bold(mainPersonName), "donor");
        var oLine = postType === "Other Occasion"
          ? (occasionText ? "के " + bold(occasionText) + " के शुभ अवसर पर" : "")
          : getOccasionLine(postType);
        if (oLine) C(oLine, "body");
      }
      donors.forEach(function (donor, i) {
        if (i > 0) L("");
        C(formatDonorWithCity(donor.name, location), "donor");
        C("द्वारा प्रदान किया जा रहा है।", "body");
      });
      L(thankYouLine);
    }

    // ── 5. Custom message ────────────────────────────────────────────────────
    if (customMessage) {
      S();
      customMessage.split("\n").forEach(function (line) {
        L(line.replace(/\s+$/, ""));
      });
    }

    // ── 6. Footer — two variants ─────────────────────────────────────────────
    S();
    if (isMemorial) {
      // पुण्यतिथि / जन्मजयंती footer
      C(bold("स्वजनों की स्मृति में गौ-आहार प्रदान करना,"), "footer");
      C(bold("उत्तम श्रद्धांजलि होती है") + " 🙏", "footer");
    } else {
      // Birthday / Anniversary / General footer
      C(bold("आप की‌ गौ-सेवा अनुकरणीय है") + "🙏", "footer");
      C(bold("सराहनीय है") + "🙏", "footer");
    }
    S();
    C(bold("गौ सेवा है प्रभु सेवा") + " 🔅 " + bold("जिव-दया है") + " " + bold("श्रेष्ठ दान"), "footer");

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
