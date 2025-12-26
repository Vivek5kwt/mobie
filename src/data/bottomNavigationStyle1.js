const bottomNavigationStyle1Section = {
  type: "object",
  title: "Bottom Navigation Component Schema",
  $schema: "http://json-schema.org/draft-07/schema#",
  children: {
    type: "array",
    maxItems: 0,
  },
  required: ["component", "props"],
  properties: {
    props: {
      type: "object",
      properties: {
        raw: {
          type: "object",
          value: {
            pb: 8,
            pl: 12,
            pr: 12,
            pt: 8,
            items: [
              {
                id: "home",
                icon: "fa-house",
                link: "",
                label: "Home",
              },
              {
                id: "cart",
                icon: "fa-cart-shopping",
                link: "",
                label: "Cart",
              },
              {
                id: "notification",
                icon: "fa-bell",
                link: "",
                label: "Notifications",
              },
              {
                id: "profile",
                icon: "fa-user",
                link: "",
                label: "Profile",
              },
            ],
            showBg: true,
            bgColor: "#FFFFFF",
            showText: true,
            iconWidth: 20,
            itemWidth: 72,
            libraryId: "30",
            showIcons: true,
            gradientTo: "",
            iconHeight: 20,
            itemHeight: 56,
            borderRadius: 0,
            gradientFrom: "",
            textFontSize: 12,
            indicatorMode: "Underline",
            indicatorSize: 28,
            indicatorColor: "#096d70",
            textFontFamily: "Inter",
            textFontWeight: "Bold",
            iconActiveColor: "#096d70",
            textActiveColor: "#096d70",
            iconPrimaryColor: "#9CA3AF",
            textPrimaryColor: "#6B7280",
            indicatorThickness: 4,
            showActiveIndicator: true,
          },
          description:
            "Raw props as used by the builder (includes toggles + all customization).",
        },
        text: {
          type: "object",
          properties: {
            fontSize: {
              type: "number",
              value: 12,
            },
            itemWidth: {
              type: "number",
              value: 72,
            },
            fontFamily: {
              type: "string",
              value: "Inter",
            },
            fontWeight: {
              type: "string",
              value: "Bold",
            },
            itemHeight: {
              type: "number",
              value: 56,
            },
            activeColor: {
              type: "string",
              value: "#096d70",
            },
            primaryColor: {
              type: "string",
              value: "#6B7280",
            },
          },
        },
        icons: {
          type: "object",
          properties: {
            width: {
              type: "number",
              value: 20,
            },
            height: {
              type: "number",
              value: 20,
            },
            activeColor: {
              type: "string",
              value: "#096d70",
            },
            primaryColor: {
              type: "string",
              value: "#9CA3AF",
            },
          },
        },
        items: {
          type: "array",
          value: [
            {
              id: "home",
              icon: "fa-house",
              link: "",
              label: "Home",
            },
            {
              id: "cart",
              icon: "fa-cart-shopping",
              link: "",
              label: "Cart",
            },
            {
              id: "notification",
              icon: "fa-bell",
              link: "",
              label: "Notifications",
            },
            {
              id: "profile",
              icon: "fa-user",
              link: "",
              label: "Profile",
            },
          ],
        },
        layout: {
          type: "object",
          properties: {
            css: {
              row: {
                gap: 8,
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-around",
              },
              icon: {
                fontSize: "20px",
                lineHeight: "1",
              },
              item: {
                gap: "4px",
                width: "72px",
                height: "56px",
                display: "flex",
                position: "relative",
                alignItems: "center",
                flexDirection: "column",
                justifyContent: "center",
              },
              label: {
                fontSize: "12px",
                fontFamily: "Inter",
                fontWeight: 700,
                lineHeight: "1.1",
              },
              container: {
                width: "100%",
                display: "flex",
                padding: "8px 12px 8px 12px",
                boxSizing: "border-box",
                alignItems: "center",
                background: "#FFFFFF",
                borderRadius: "0px",
                justifyContent: "space-around",
              },
              indicator: {
                mode: "Underline",
                size: 28,
                color: "#096d70",
                thickness: 4,
              },
              classNames: {
                icon: "ab-bottomNavIcon",
                item: "ab-bottomNavItem",
                label: "ab-bottomNavLabel",
                container: "ab-bottomNav",
                indicator: "ab-bottomNavIndicator",
                description:
                  "DOM classes used by web builder; keep for styling hooks + measurements.",
              },
              description:
                "CSS snapshot for Bottom Navigation in phone view. Apply as-is to reproduce the exact design.",
            },
            notes: {
              type: "string",
              value:
                "Apply layout.css as CSS; coordinates in layout.metrics are relative to the container's top-left (px). Keep provided classNames.",
            },
            metrics: {
              elements: {
                container: {
                  x: 0,
                  y: 0,
                  width: 387,
                  height: 72,
                },
                icon_cart: {
                  x: 127,
                  y: 17,
                  width: 20,
                  height: 20,
                },
                icon_home: {
                  x: 38,
                  y: 10,
                  width: 20,
                  height: 20,
                },
                item_cart: {
                  x: 101,
                  y: 8,
                  width: 72,
                  height: 56,
                },
                item_home: {
                  x: 12,
                  y: 8,
                  width: 72,
                  height: 56,
                },
                label_cart: {
                  x: 125,
                  y: 41,
                  width: 24,
                  height: 13,
                },
                label_home: {
                  x: 33,
                  y: 48,
                  width: 31,
                  height: 13,
                },
                icon_profile: {
                  x: 305,
                  y: 17,
                  width: 20,
                  height: 20,
                },
                item_profile: {
                  x: 279,
                  y: 8,
                  width: 72,
                  height: 56,
                },
                label_profile: {
                  x: 298,
                  y: 41,
                  width: 34,
                  height: 13,
                },
                indicator_home: {
                  x: 34,
                  y: 40,
                  width: 28,
                  height: 4,
                },
                icon_notification: {
                  x: 216,
                  y: 17,
                  width: 20,
                  height: 20,
                },
                item_notification: {
                  x: 190,
                  y: 8,
                  width: 72,
                  height: 56,
                },
                label_notification: {
                  x: 193,
                  y: 41,
                  width: 65,
                  height: 13,
                },
              },
              available: true,
              container: {
                width: 387,
                height: 72,
              },
              timestamp: 1766731041996,
              description:
                "Absolute positions (x,y) and sizes (width,height) of Bottom Navigation elements relative to the container (top-left origin, px).",
              coordinateSystem: {
                unit: "px",
                origin: "top-left of .ab-bottomNav container",
              },
            },
          },
          description:
            "Bottom Navigation presentation details for RN/web to generate identical HTML/CSS.",
        },
        indicator: {
          type: "object",
          properties: {
            mode: {
              type: "string",
              value: "None",
            },
            size: {
              type: "number",
              value: 28,
            },
            color: {
              type: "string",
              value: "#096d70",
            },
            thickness: {
              type: "number",
              value: 4,
            },
          },
        },
        visibility: {
          type: "object",
          properties: {
            icons: {
              type: "boolean",
              value: true,
            },
            labels: {
              type: "boolean",
              value: true,
            },
            bgPadding: {
              type: "boolean",
              value: true,
            },
            activeIndicator: {
              type: "boolean",
              value: true,
            },
          },
        },
        activeIndex: {
          type: "number",
          value: 0,
        },
        presentation: {
          type: "object",
          properties: {
            css: {
              row: {
                gap: 8,
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-around",
              },
              icon: {
                fontSize: "20px",
                lineHeight: "1",
              },
              item: {
                gap: "4px",
                width: "72px",
                height: "56px",
                display: "flex",
                position: "relative",
                alignItems: "center",
                flexDirection: "column",
                justifyContent: "center",
              },
              label: {
                fontSize: "12px",
                fontFamily: "Inter",
                fontWeight: 700,
                lineHeight: "1.1",
              },
              container: {
                width: "100%",
                display: "flex",
                padding: "8px 12px 8px 12px",
                boxSizing: "border-box",
                alignItems: "center",
                background: "#FFFFFF",
                borderRadius: "0px",
                justifyContent: "space-around",
              },
              indicator: {
                mode: "Underline",
                size: 28,
                color: "#096d70",
                thickness: 4,
              },
              classNames: {
                icon: "ab-bottomNavIcon",
                item: "ab-bottomNavItem",
                label: "ab-bottomNavLabel",
                container: "ab-bottomNav",
                indicator: "ab-bottomNavIndicator",
                description:
                  "DOM classes used by web builder; keep for styling hooks + measurements.",
              },
              description:
                "CSS snapshot for Bottom Navigation in phone view. Apply as-is to reproduce the exact design.",
            },
            notes: {
              type: "string",
              value:
                "Apply presentation.css as CSS; coordinates in presentation.metrics are relative to the container's top-left (px). Keep provided classNames.",
            },
            metrics: {
              elements: {
                container: {
                  x: 0,
                  y: 0,
                  width: 387,
                  height: 72,
                },
                icon_cart: {
                  x: 127,
                  y: 17,
                  width: 20,
                  height: 20,
                },
                icon_home: {
                  x: 38,
                  y: 10,
                  width: 20,
                  height: 20,
                },
                item_cart: {
                  x: 101,
                  y: 8,
                  width: 72,
                  height: 56,
                },
                item_home: {
                  x: 12,
                  y: 8,
                  width: 72,
                  height: 56,
                },
                label_cart: {
                  x: 125,
                  y: 41,
                  width: 24,
                  height: 13,
                },
                label_home: {
                  x: 33,
                  y: 48,
                  width: 31,
                  height: 13,
                },
                icon_profile: {
                  x: 305,
                  y: 17,
                  width: 20,
                  height: 20,
                },
                item_profile: {
                  x: 279,
                  y: 8,
                  width: 72,
                  height: 56,
                },
                label_profile: {
                  x: 298,
                  y: 41,
                  width: 34,
                  height: 13,
                },
                indicator_home: {
                  x: 34,
                  y: 40,
                  width: 28,
                  height: 4,
                },
                icon_notification: {
                  x: 216,
                  y: 17,
                  width: 20,
                  height: 20,
                },
                item_notification: {
                  x: 190,
                  y: 8,
                  width: 72,
                  height: 56,
                },
                label_notification: {
                  x: 193,
                  y: 41,
                  width: 65,
                  height: 13,
                },
              },
              available: true,
              container: {
                width: 387,
                height: 72,
              },
              timestamp: 1766731041996,
              description:
                "Absolute positions (x,y) and sizes (width,height) of Bottom Navigation elements relative to the container (top-left origin, px).",
              coordinateSystem: {
                unit: "px",
                origin: "top-left of .ab-bottomNav container",
              },
            },
            classNames: {
              row: "ab-bottomNavRow",
              icon: "ab-bottomNavIcon",
              item: "ab-bottomNavItem",
              label: "ab-bottomNavLabel",
              container: "ab-bottomNav",
              indicator: "ab-bottomNavIndicator",
              description:
                "DOM classes used by web builder for Bottom Navigation.",
            },
          },
          description:
            "Presentation bundle for Bottom Navigation renderer (CSS snapshot + measured coordinates).",
        },
        backgroundAndPadding: {
          type: "object",
          properties: {
            padding: {
              type: "number",
              value: 12,
            },
            gradientTo: {
              type: "string",
              value: "",
            },
            paddingRaw: {
              type: "object",
              properties: {
                pb: {
                  type: "number",
                  value: 8,
                },
                pl: {
                  type: "number",
                  value: 12,
                },
                pr: {
                  type: "number",
                  value: 12,
                },
                pt: {
                  type: "number",
                  value: 8,
                },
              },
            },
            borderRadius: {
              type: "number",
              value: 0,
            },
            gradientFrom: {
              type: "string",
              value: "",
            },
            backgroundColor: {
              type: "string",
              value: "#FFFFFF",
            },
          },
        },
      },
    },
    component: {
      const: "bottom_navigation_style_1",
    },
  },
};

export default bottomNavigationStyle1Section;
