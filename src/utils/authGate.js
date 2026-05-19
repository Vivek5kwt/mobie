import { fetchDSL } from "../engine/dslHandler";

let signinDslAvailableCache = null;

const sectionComponentName = (section = {}) =>
  String(
    section?.component?.const ||
      section?.component ||
      section?.properties?.component?.const ||
      section?.properties?.component ||
      ""
  )
    .trim()
    .toLowerCase();

export const hasSigninDsl = async () => {
  if (signinDslAvailableCache !== null) return signinDslAvailableCache;
  try {
    const dslPayload = await fetchDSL(undefined, "signin");
    const sections = Array.isArray(dslPayload?.dsl?.sections) ? dslPayload.dsl.sections : [];
    signinDslAvailableCache = sections.some((section) => {
      const name = sectionComponentName(section);
      return name === "signin" || name === "forgot_password";
    });
    return signinDslAvailableCache;
  } catch (_) {
    signinDslAvailableCache = false;
    return false;
  }
};

const hasAuthValue = (value) => {
  if (value === undefined || value === null) return false;
  return String(value).trim().length > 0;
};

export const isAuthenticatedSession = (session) => {
  if (!session) return false;
  const user = session?.user || {};
  return Boolean(
    hasAuthValue(session?.token) ||
      hasAuthValue(session?.accessToken) ||
      hasAuthValue(user?.id) ||
      hasAuthValue(user?.email) ||
      hasAuthValue(user?.userToken) ||
      hasAuthValue(user?.customerAccessToken) ||
      hasAuthValue(session?.customerAccessToken)
  );
};

export const requireLoginForAction = async ({ session, navigation, postLoginTarget, initializing = false }) => {
  if (isAuthenticatedSession(session)) return false;
  if (initializing) return true;
  try {
    const authParams = { initialMode: "login", requireAuth: true };
    if (postLoginTarget?.name) {
      authParams.postLoginTarget = postLoginTarget;
    }
    navigation?.navigate?.("Auth", authParams);
  } catch (_) {
    // no-op
  }
  return true;
};
