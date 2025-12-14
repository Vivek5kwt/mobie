export function normalizeDSLSection(section) {
    if (!section) return section;
  
    const normalized = { ...section };
  
    normalized.component =
      section?.properties?.component?.const ||
      section?.component ||
      null;
  
    const propsObj = section?.properties?.props?.properties;
    if (propsObj) {
      normalized.props = unwrapProps(propsObj);
    }
  
    return normalized;
  }
  
  function unwrapProps(obj) {
    const out = {};
  
    for (let key in obj) {
      const prop = obj[key];
  
      if (prop?.value !== undefined) {
        out[key] = prop.value;
        continue;
      }
  
      if (prop?.properties) {
        out[key] = unwrapProps(prop.properties);
        continue;
      }
  
      out[key] = prop;
    }
  
    return out;
  }
  