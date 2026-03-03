/**
 * Header 2 section — Header Component Schema (logo bar).
 * Use this in your DSL sections to show the simple header on mobile:
 * [ leftSlot: side menu ] [ logoSlot: logo or text ] [ rightSlot: cart, notification ]
 */
const header2Section = {
  component: "header_2",
  props: {
    cart: {
      type: "object",
      properties: {
        color: { type: "string", value: "#016D77" },
        width: { type: "number", value: 18 },
        iconId: { type: "string", value: "cart-shopping" },
        visible: { type: "boolean", value: true },
        showBadge: { type: "boolean", value: true },
      },
    },
    style: {
      type: "object",
      properties: {
        padding: { type: "string", value: "14px 16px" },
        minHeight: { type: "number", value: 60 },
        borderColor: { type: "string", value: "#016D77" },
        backgroundColor: { type: "string", value: "#E0F7F8" },
      },
    },
    layout: {
      type: "object",
      properties: {
        css: {
          badge: {
            top: -4,
            right: -4,
            width: 8,
            border: "1px solid #ffffff",
            height: 8,
            position: "absolute",
            borderRadius: "50%",
            backgroundColor: "#22C55E",
          },
          leftSlot: {
            width: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
          },
          logoSlot: {
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          },
          logoImage: {
            width: "auto",
            height: 26,
            objectFit: "contain",
          },
          rightSlot: {
            gap: 14,
            display: "flex",
            minWidth: 90,
            alignItems: "center",
            justifyContent: "flex-end",
          },
          container: {
            width: "100%",
            border: "1px solid #016D77",
            display: "flex",
            padding: "14px 16px",
            boxSizing: "border-box",
            minHeight: 60,
            alignItems: "center",
            borderRadius: 0,
            justifyContent: "space-between",
            backgroundColor: "#E0F7F8",
          },
        },
      },
    },
    sideMenu: {
      type: "object",
      properties: {
        color: { type: "string", value: "#016D77" },
        width: { type: "number", value: 18 },
        iconId: { type: "string", value: "bars" },
        visible: { type: "boolean", value: true },
      },
    },
    logoAlign: { type: "string", value: "Center" },
    logoImage: { type: "string", value: "/images/mobidrag.png" },
    enableLogo: { type: "boolean", value: true },
    headerText: { type: "string", value: "Logo" },
    notification: {
      type: "object",
      properties: {
        color: { type: "string", value: "#016D77" },
        width: { type: "number", value: 18 },
        iconId: { type: "string", value: "bell" },
        visible: { type: "boolean", value: true },
        showBadge: { type: "boolean", value: true },
      },
    },
    headerTextBold: { type: "boolean", value: false },
    headerTextSize: { type: "number", value: 14 },
    headerTextAlign: { type: "string", value: "Center" },
    headerTextColor: { type: "string", value: "#0C1C2C" },
    enableheaderText: { type: "boolean", value: false },
    headerFontFamily: { type: "string", value: "Poppins, system-ui, sans-serif" },
    headerFontWeight: { type: "string", value: "Regular" },
    headerTextItalic: { type: "boolean", value: false },
    headerTextUnderline: { type: "boolean", value: false },
  },
};

export default header2Section;
