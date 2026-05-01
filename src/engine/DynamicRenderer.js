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
import VariantSelector from "../components/VariantSelector";
import TrustBadges from "../components/TrustBadges";
import CustomerReviews from "../components/CustomerReviews";
import FreeShipping from "../components/FreeShipping";
import DiscountCode from "../components/DiscountCode";
import OrderSummary from "../components/OrderSummary";
import ProfileHeader from "../components/ProfileHeader";
import TestimonialCardNew from "../components/TestimonialCardNew";
import AboutUs from "../components/AboutUs";
import WishlistItem from "../components/WishlistItem";
import ConfirmationHeader from "../components/ConfirmationHeader";
import FilterSortHeader from "../components/FilterSortHeader";
import RecentProducts from "../components/RecentProducts";

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
  variant_selector: VariantSelector,
  trust_badges: TrustBadges,
  customer_reviews: CustomerReviews,
  product_reviews: CustomerReviews,
  reviews: CustomerReviews,
  review: CustomerReviews,
  free_shipping: FreeShipping,
  free_shipping_bar: FreeShipping,
  free_shipping_banner: FreeShipping,
  shipping_progress: FreeShipping,
  cart_free_shipping: FreeShipping,
  discount_code: DiscountCode,
  discount_coupons: DiscountCode,
  gift_card: DiscountCode,
  discount_gift_card: DiscountCode,
  coupon_code: DiscountCode,
  cart_discount: DiscountCode,
  order_summary: OrderSummary,
  price_line: OrderSummary,
  cart_summary: OrderSummary,
  cart_total: OrderSummary,
  profile_header: ProfileHeader,
  account_profile_header: ProfileHeader,
  user_profile_header: ProfileHeader,
  profile_card: ProfileHeader,
  signup: SignUp,
  sign_up: SignUp,
  "sign-up": SignUp,
  testimonial_card_new: TestimonialCardNew,
  testimonial_card: TestimonialCardNew,
  testimonials: TestimonialCardNew,
  about_us: AboutUs,
  "about-us": AboutUs,
  wishlist_item: WishlistItem,
  wishlist: WishlistItem,
  "wishlist-item": WishlistItem,
  confirmation_header: ConfirmationHeader,
  "confirmation-header": ConfirmationHeader,
  order_confirmation: ConfirmationHeader,
  filter_sort_header: FilterSortHeader,
  "filter-sort-header": FilterSortHeader,
  filter_header: FilterSortHeader,
  sort_header: FilterSortHeader,
  recent_products: RecentProducts,
  recently_viewed: RecentProducts,
  recent_viewed: RecentProducts,
  recentproducts: RecentProducts,
  recentlyviewed: RecentProducts,
};

const componentAliases = {
  // Hero banner
  herobanner: "hero_banner",
  "hero-banner": "hero_banner",
  "hero banner": "hero_banner",
  // Bottom nav
  bottom_nav: "bottom_navigation",
  "bottom-nav": "bottom_navigation",
  bottomnav: "bottom_navigation",
  // Reviews (builder may send camelCase)
  customerreviews: "customer_reviews",
  "customer-reviews": "customer_reviews",
  productreviews: "product_reviews",
  "product-reviews": "product_reviews",
  // Variant selector
  variantselector: "variant_selector",
  "variant-selector": "variant_selector",
  // Add to cart
  addtocart: "add_to_cart",
  "add-to-cart": "add_to_cart",
  // Product components
  productinfo: "product_info",
  "product-info": "product_info",
  productdescription: "product_description",
  "product-description": "product_description",
  productlibrary: "product_library",
  "product-library": "product_library",
  // Filter / sort
  filtersort: "filter_sort_header",
  "filter-sort": "filter_sort_header",
  filtersortheader: "filter_sort_header",
  "filter-sort-header": "filter_sort_header",
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
