import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import HeaderDefault from "../components/HeaderDefault";
import BottomNavigation, { BOTTOM_NAV_RESERVED_HEIGHT } from "../components/BottomNavigation";
import { fetchDSL } from "../engine/dslHandler";
import { fetchShopifyCollections, getShopifyDomain } from "../services/shopify";
import { resolveAppId } from "../utils/appId";
import { SafeArea } from "../utils/SafeAreaHandler";
import { resolveProductImageResizeMode } from "../utils/productImageFit";
import { getResponsiveColumns } from "../utils/responsiveLayout";

const GAP = 12;
const H_PAD = 16;

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.default !== undefined) return value.default;
    if (value.properties !== undefined) return value.properties;
  }
  return value;
};

const asArray = (value) => {
  const resolved = unwrapValue(value, value);
  if (Array.isArray(resolved)) return resolved;
  if (Array.isArray(resolved?.items)) return resolved.items;
  if (Array.isArray(resolved?.value)) return resolved.value;
  return [];
};

const normalizeKey = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const deriveHandle = (item = {}) => {
  if (item.handle) return normalizeKey(item.handle);
  const link = item.link || item.href || item.url || "";
  if (typeof link === "string" && link.includes("/collections/")) {
    return normalizeKey(link.split("/collections/")[1]?.split(/[?#/]/)[0]);
  }
  return normalizeKey(item.title || item.label || item.name);
};

const imageFrom = (...candidates) => {
  for (const candidate of candidates) {
    const value = unwrapValue(candidate, "");
    if (!value) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
      continue;
    }
    if (typeof value === "object") {
      const nested = imageFrom(
        value.url,
        value.src,
        value.uri,
        value.image,
        value.imageUrl,
        value.thumbnail,
        value.preview
      );
      if (nested) return nested;
    }
  }
  return "";
};

const isRenderableImageUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  const value = url.trim();
  if (!value || /^blob:/i.test(value)) return false;
  return /^(https?:|data:image\/|file:)/i.test(value);
};

const normalizeItem = (item = {}) => {
  const p = item?.properties || item;
  const title = unwrapValue(p.title ?? p.label ?? p.name ?? p.text, "");
  const image = imageFrom(p.image, p.imageUrl, p.src, p.thumbnail, p.uploadImage, p.backgroundImageUrl);
  const link = unwrapValue(p.link ?? p.href ?? p.url, "");
  const handle = unwrapValue(p.handle ?? p.collectionHandle ?? p.navigateRef, "");
  const id = unwrapValue(p.id, "") || handle || title;
  const subCollections = [
    ...asArray(p.subCollections),
    ...asArray(p.sub_collections),
    ...asArray(p.children),
    ...asArray(p.items),
  ].map(normalizeItem).filter(Boolean);
  if (!title && !handle) return null;
  return {
    id: String(id || title || handle),
    title: String(title || handle || "Collection"),
    image: String(image || ""),
    link: String(link || ""),
    handle: String(handle || ""),
    subCollections,
  };
};

const getComponentName = (section = {}) =>
  String(
    section?.component?.const ||
    section?.component ||
    section?.properties?.component?.const ||
    section?.properties?.component ||
    ""
  ).toLowerCase();

const getSectionProps = (section = {}) =>
  section?.props ||
  section?.properties?.props?.properties ||
  section?.properties?.props ||
  {};

const extractCollectionItemsFromValue = (value) => {
  const resolved = unwrapValue(value, value);
  if (!resolved) return [];

  if (Array.isArray(resolved)) {
    return resolved.map(normalizeItem).filter(Boolean);
  }

  if (Array.isArray(resolved?.items)) {
    return resolved.items.map(normalizeItem).filter(Boolean);
  }

  if (Array.isArray(resolved?.value)) {
    return resolved.value.map(normalizeItem).filter(Boolean);
  }

  if (typeof resolved === "object") {
    return Object.entries(resolved)
      .filter(([key, item]) => {
        if (/^collection-\d+$/i.test(key)) return true;
        const p = item?.properties || item || {};
        return p.title || p.label || p.name || p.image || p.imageUrl || p.handle || p.collectionHandle;
      })
      .map(([, item]) => normalizeItem(item))
      .filter(Boolean);
  }

  return [];
};

const findCollectionSectionItems = (dsl = {}) => {
  const sections = dsl?.sections || [];
  const collectionSections = sections.filter((section) => {
    const component = getComponentName(section);
    return [
      "collection",
      "collections",
      "collection_image",
      "collection_slider",
      "category",
      "categories",
    ].includes(component);
  });

  const items = [];
  collectionSections.forEach((section) => {
    const props = getSectionProps(section);
    const raw = unwrapValue(props.raw, {});
    items.push(
      ...extractCollectionItemsFromValue(props.items),
      ...extractCollectionItemsFromValue(raw?.items),
      ...extractCollectionItemsFromValue(props.collections),
      ...extractCollectionItemsFromValue(raw?.collections),
      ...extractCollectionItemsFromValue(props.children),
      ...extractCollectionItemsFromValue(raw?.children)
    );
  });

  return items;
};

const normalizeStoreCollection = (collection = {}) => ({
  id: String(collection.id || collection.handle || collection.title || ""),
  title: collection.title || collection.handle || "Collection",
  image: collection.imageUrl || collection.image || "",
  handle: collection.handle || "",
  link: collection.handle ? `https://${getShopifyDomain()}/collections/${collection.handle}` : "",
});

const aliasMatches = {
  hoodie: ["hoodies", "hoodies-sweatshirts", "sweatshirts"],
  hoodies: ["hoodie", "hoodies-sweatshirts", "sweatshirts"],
  tshirt: ["t-shirt", "t-shirts", "tee", "tees", "oversized-t-shirts"],
  "t-shirt": ["tshirt", "t-shirts", "tee", "tees", "oversized-t-shirts"],
  shoes: ["shoe", "sneaker", "sneakers", "footwear"],
};

const findStoreMatch = (item, storeItems) => {
  const itemHandle = normalizeKey(deriveHandle(item));
  const itemTitle = normalizeKey(item.title);
  const aliases = new Set([
    itemHandle,
    itemTitle,
    ...(aliasMatches[itemHandle] || []),
    ...(aliasMatches[itemTitle] || []),
  ].filter(Boolean));

  return storeItems.find((storeItem) => {
    const storeHandle = normalizeKey(storeItem.handle);
    const storeTitle = normalizeKey(storeItem.title);
    if (aliases.has(storeHandle) || aliases.has(storeTitle)) return true;
    for (const key of aliases) {
      if (!key || key.length < 3) continue;
      if (storeHandle.includes(key) || storeTitle.includes(key) || key.includes(storeHandle) || key.includes(storeTitle)) {
        return true;
      }
    }
    return false;
  });
};

const mergeWithStoreCollections = (dslItems, storeItems) => {
  if (!dslItems.length) return [];

  const sourceItems = dslItems;

  const merged = sourceItems.map((item) => {
    const match = findStoreMatch(item, storeItems);
    return {
      ...(match || {}),
      ...item,
      handle: item.handle || match?.handle || deriveHandle(item),
      image: isRenderableImageUrl(item.image) ? item.image : match?.image || item.image || "",
      link: item.link || match?.link || "",
    };
  });

  const seen = new Set();
  return merged.filter((item) => {
    const key = normalizeKey(item.handle || item.title);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const findBottomNavSection = (dsl = {}) =>
  (dsl?.sections || []).find((section) => {
    const component = getComponentName(section);
    return ["bottom_navigation", "bottom_navigation_style_1", "bottom_navigation_style_2"].includes(component);
  }) || null;

export default function SubCollectionScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { width: screenWidth } = useWindowDimensions();
  const {
    collectionHandle,
    handle,
    collectionTitle,
    title,
    label,
    parentCollection,
    sourcePageName,
  } = route?.params || {};

  const parentHandle = collectionHandle || handle || parentCollection?.handle || "";
  const parentTitle = collectionTitle || title || label || parentCollection?.title || "Collection";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [homeHeaderConfig, setHomeHeaderConfig] = useState(null);
  const [pageHeaderConfig, setPageHeaderConfig] = useState(null);
  const [bottomNavSection, setBottomNavSection] = useState(null);
  const [bottomNavHeight, setBottomNavHeight] = useState(BOTTOM_NAV_RESERVED_HEIGHT);

  useEffect(() => {
    let mounted = true;
    const appId = resolveAppId();

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const pageCandidates = Array.from(new Set([
          sourcePageName,
          parentHandle,
          parentTitle,
          "collections",
          "collection",
          "categories",
          "category",
          "sub-collections",
        ].filter(Boolean)));

        const [homeData, pageResults, productListData, storeCollections] = await Promise.all([
          fetchDSL(appId, "home").catch(() => null),
          Promise.all(pageCandidates.map((page) => fetchDSL(appId, page).catch(() => null))),
          fetchDSL(appId, "product-list").catch(() => null),
          fetchShopifyCollections(100).catch(() => []),
        ]);
        if (!mounted) return;

        const homeDsl = homeData?.dsl || homeData || {};
        const productListDsl = productListData?.dsl || productListData || {};
        const matchedPageHeaderConfig = (pageResults || [])
          .map((pageData) => (pageData?.dsl || pageData || {})?.headerdefault)
          .find(Boolean);
        const routedItems = asArray(parentCollection?.subCollections).map(normalizeItem).filter(Boolean);
        const collectionDslItems = (pageResults || [])
          .flatMap((pageData) => findCollectionSectionItems(pageData?.dsl || pageData || {}))
          .filter((item) => normalizeKey(item.handle || item.title) !== normalizeKey(parentHandle || parentTitle));
        const dslItems = routedItems.length ? routedItems : collectionDslItems;
        const storeItems = (storeCollections || [])
          .map(normalizeStoreCollection)
          .filter((item) => item.title || item.handle);

        setHomeHeaderConfig(homeDsl?.headerdefault || null);
        setPageHeaderConfig(matchedPageHeaderConfig || productListDsl?.headerdefault || null);
        setBottomNavSection(findBottomNavSection(homeDsl));
        setItems(mergeWithStoreCollections(dslItems, storeItems));
      } catch (_) {
        if (mounted) setError("Unable to load sub-collections right now.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [parentCollection, parentHandle, parentTitle, sourcePageName]);

  const openProducts = useCallback((item) => {
    const nextHandle = item?.handle || deriveHandle(item);
    if (!nextHandle) return;
    navigation.navigate("CollectionProducts", {
      collectionHandle: nextHandle,
      collectionTitle: item?.title || "Products",
      parentCollection: {
        handle: parentHandle,
        title: parentTitle,
      },
      selectedSubCollection: {
        handle: nextHandle,
        title: item?.title || "Products",
      },
    });
  }, [navigation, parentHandle, parentTitle]);

  const viewportWidth = Math.max(1, screenWidth);
  const columns = getResponsiveColumns({
    screenWidth: viewportWidth,
    requestedColumns: 2,
    horizontalPadding: H_PAD * 2,
    gap: GAP,
    minCardWidth: 220,
    maxColumns: 4,
  });
  const cardWidth = (viewportWidth - H_PAD * 2 - GAP * (columns - 1)) / columns;

  const renderItem = useCallback(({ item }) => (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth }]}
      activeOpacity={0.86}
      onPress={() => openProducts(item)}
    >
      {isRenderableImageUrl(item.image) ? (
        <Image source={{ uri: item.image }} style={styles.image} resizeMode={resolveProductImageResizeMode()} />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Text style={styles.placeholderText}>
            {(item.title || "?").charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.cardHint}>View products</Text>
      </View>
    </TouchableOpacity>
  ), [cardWidth, openProducts]);

  const headerSubtitle = useMemo(() => {
    if (!parentTitle) return "Choose a sub-collection";
    return `Choose a sub-collection in ${parentTitle}`;
  }, [parentTitle]);
  const showHeading = items.length > 0;

  return (
    <SafeArea edges={["top", "left", "right"]}>
      <View style={styles.container}>
        {pageHeaderConfig ? (
          <HeaderDefault config={pageHeaderConfig} bottomNavSection={bottomNavSection} hideTabs showBack />
        ) : null}

        {showHeading ? (
          <View style={styles.heading}>
            <Text style={styles.title}>{parentTitle}</Text>
            <Text style={styles.subtitle}>{headerSubtitle}</Text>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator style={styles.loader} size="small" color="#016D77" />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <FlatList
            key={`cols-${columns}`}
            data={items}
            keyExtractor={(item) => String(item.handle || item.id || item.title)}
            numColumns={columns}
            columnWrapperStyle={styles.row}
            renderItem={renderItem}
            contentContainerStyle={[
              styles.list,
              { paddingBottom: bottomNavSection ? bottomNavHeight + 16 : 32 },
            ]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.empty}>
                No sub-collections are available for this collection.
              </Text>
            }
          />
        )}

        {bottomNavSection && (
          <View
            style={styles.bottomNav}
            onLayout={(event) => setBottomNavHeight(event.nativeEvent.layout.height)}
          >
            <BottomNavigation section={bottomNavSection} />
          </View>
        )}
      </View>
    </SafeArea>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  heading: {
    paddingHorizontal: H_PAD,
    paddingTop: 16,
    paddingBottom: 10,
  },
  title: {
    color: "#016D77",
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 4,
  },
  list: {
    paddingHorizontal: H_PAD,
    paddingTop: 6,
    rowGap: GAP,
  },
  row: {
    gap: GAP,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#FFFFFF",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    color: "#016D77",
    fontSize: 34,
    fontWeight: "700",
  },
  cardBody: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  cardTitle: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
    minHeight: 34,
  },
  cardHint: {
    color: "#016D77",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  loader: {
    marginTop: 32,
  },
  error: {
    color: "#B91C1C",
    paddingHorizontal: H_PAD,
    paddingVertical: 24,
    textAlign: "center",
  },
  empty: {
    color: "#6B7280",
    fontSize: 14,
    paddingVertical: 32,
    textAlign: "center",
  },
});
