function timestamp() {
  return new Date().toISOString();
}

function formatMeta(meta) {
  if (meta === undefined || meta === null) {
    return "";
  }

  if (typeof meta === "string") {
    return ` ${meta}`;
  }

  try {
    return ` ${JSON.stringify(meta)}`;
  } catch (_error) {
    return " [unserializable-meta]";
  }
}

function write(level, scope, message, meta) {
  const line = `[${timestamp()}] [${level}] [${scope}] ${message}${formatMeta(meta)}`;

  if (level === "ERROR") {
    console.error(line);
    return;
  }

  if (level === "WARN") {
    console.warn(line);
    return;
  }

  console.log(line);
}

function createLogger(scope) {
  const safeScope = String(scope || "app");

  return {
    info(message, meta) {
      write("INFO", safeScope, message, meta);
    },
    warn(message, meta) {
      write("WARN", safeScope, message, meta);
    },
    error(message, meta) {
      write("ERROR", safeScope, message, meta);
    },
    debug(message, meta) {
      if (process.env.NODE_ENV !== "production") {
        write("DEBUG", safeScope, message, meta);
      }
    },
  };
}

module.exports = {
  createLogger,
};
