// engine/DynamicRenderer.js
import React from "react";

// LIVE COMPONENTS
import Header from "../components/Topheader";       // Live Header (v1)
import Header2 from "../components/Header2";     // Live Header (v2 / mobile)
import CollectionImage from "../components/CollectionImage";
import Countdown from "../components/Countdown";
import MediaGrid from "../components/MediaGrid";
import BannerSlider from "../components/BannerSlider";
import HeroBanner from "../components/HeroBanner";
import SocialMediaIcons from "../components/SocialMediaIcons";
import ProductGrid from "../components/ProductGrid";
import TextBlock from "../components/TextBlock";
import SearchBar from "../components/SearchBar";
import SideNavigation from "../components/SideNavigation";
import TrendingCollections from "../components/TrendingCollections";
import TrendingSearches from "../components/TrendingSearches";
import TabProductGrid from "../components/TabProductGrid";
import BottomNavigation from "../components/BottomNavigation";

// COMPONENT MAP — ALL LIVE ONLY
const componentMap = {
  header: Header,               // LIVE HEADER 1
  header_mobile: Header,
  header_2: Header2,
  header_2_mobile: Header2,
  collection_image: CollectionImage,
  countdown: Countdown,
  media_grid: MediaGrid,
  banner_slider: BannerSlider,
  hero_banner: HeroBanner,
  social_media_icons: SocialMediaIcons,
  product_grid: ProductGrid,
  text_block: TextBlock,
  search_bar: SearchBar,
  side_navigation: SideNavigation,
  bottom_navigation: BottomNavigation,
  trending_collections: TrendingCollections,
  trending_searches: TrendingSearches,
  tab_product_grid: TabProductGrid,
};

// detect mobile version for header_2
function inferMobileVariant(section) {
  const title = section?.title || "";
  if (String(title).toLowerCase().includes("mobile")) {
    return true;
  }

  const comp = section?.properties?.component?.const;
  if (/header_2_mobile/i.test(comp)) return true;

  return false;
}

export default function DynamicRenderer({ section }) {
  try {
    // extract DSL component name
    let compName = section?.properties?.component?.const || "";

    // auto-switch for header_2 mobile
    if (compName === "header_2") {
      const isMobile = inferMobileVariant(section);
      if (isMobile) compName = "header_2_mobile";
    }

    compName = compName.toLowerCase();

    const Component = componentMap[compName];

    if (!Component) {
      console.log("❌ Component NOT FOUND:", compName);
      console.log("Available:", Object.keys(componentMap));
      return null;
    }

    return <Component section={section} />;

  } catch (err) {
    console.log("❌ DynamicRenderer error:", err);
    return null;
  }
}
