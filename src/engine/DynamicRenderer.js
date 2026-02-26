// engine/DynamicRenderer.js
import React from "react";

// LIVE COMPONENTS
import Header from "../components/Topheader";       // Live Header (v1)
import Header2 from "../components/Header2";
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
import AccountProfile from "../components/AccountProfile";
import AccountMenu from "../components/AccountMenu";
import ProductLibrary from "../components/ProductLibrary";
import ProductInfo from "../components/ProductInfo";
import ProductDescription from "../components/ProductDescription";
import AddToCart from "../components/AddToCart";
import CartLineItems from "../components/CartLineItems";
import CheckoutButton from "../components/CheckoutButton";
import FaqNew from "../components/FaqNew";
import ProductCarousel from "../components/ProductCarousel";
import SignUp from "../components/SignUp";

const normalizeComponentName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

// COMPONENT MAP — ALL LIVE ONLY
const componentMap = {
  header: Header,               // LIVE HEADER 1
  header_mobile: Header,
  header_2: Header2,
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
  bottom_navigation_style_1: BottomNavigation,
  bottom_navigation_style_2: BottomNavigation,
  trending_collections: TrendingCollections,
  trending_searches: TrendingSearches,
  tab_product_grid: TabProductGrid,
  tab_product_carousel: TabProductGrid,
  account_profile: AccountProfile,
  account_menu: AccountMenu,
  product_library: ProductLibrary,
  product_info: ProductInfo,
  product_description: ProductDescription,
  add_to_cart: AddToCart,
  cart_line_items: CartLineItems,
  checkout_button: CheckoutButton,
  faq_new: FaqNew,
  product_carousel: ProductCarousel,
  signup: SignUp,
  sign_up: SignUp,
  "sign-up": SignUp,
};

const componentAliases = {
  herobanner: "hero_banner",
  "hero-banner": "hero_banner",
  "hero banner": "hero_banner",
};

export default function DynamicRenderer({ section }) {
  try {
    // extract DSL component name
    let compName =
      section?.component?.const ||
      section?.component ||
      section?.properties?.component?.const ||
      section?.properties?.component ||
      "";

    compName = normalizeComponentName(compName);
    compName = componentAliases[compName] || compName;

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
