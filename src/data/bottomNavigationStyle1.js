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
            libraryId: "31",
            showIcons: true,
            gradientTo: "",
            iconHeight: 20,
            itemHeight: 56,
            borderRadius: 28,
            gradientFrom: "",
            textFontSize: 12,
            indicatorMode: "Bubble",
            indicatorSize: 24,
            indicatorColor: "#096d70",
            textFontFamily: "Inter",
            textFontWeight: "Bold",
            iconActiveColor: "#FFFFFF",
            textActiveColor: "#096d70",
            iconPrimaryColor: "#9CA3AF",
            textPrimaryColor: "#6B7280",
            indicatorThickness: 6,
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
              value: "#FFFFFF",
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
              icon: {
                fontSize: "18px",
                lineHeight: "18px",
              },
              item: {
                gap: "4px",
                display: "flex",
                position: "relative",
                alignItems: "center",
                flexDirection: "column",
                justifyContent: "center",
              },
              label: {
                fontSize: "12px",
                lineHeight: "14px",
              },
              container: {
                width: "100%",
                display: "flex",
                padding: "12px",
                alignItems: "center",
                background: "#FFFFFF",
                borderRadius: "28px",
                justifyContent: "space-around",
              },
              indicator: {
                mode: "Bubble",
                size: 24,
                color: "#096d70",
                thickness: 6,
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
              elements: {},
              available: false,
              container: {
                width: 278,
                height: 56,
              },
              timestamp: 1766731247604,
              description:
                "Fallback metrics for Bottom Navigation (no live measurement captured).",
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
              value: "Bubble",
            },
            size: {
              type: "number",
              value: 36,
            },
            color: {
              type: "string",
              value: "#096d70",
            },
            thickness: {
              type: "number",
              value: 6,
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
              icon: {
                fontSize: "18px",
                lineHeight: "18px",
              },
              item: {
                gap: "4px",
                display: "flex",
                position: "relative",
                alignItems: "center",
                flexDirection: "column",
                justifyContent: "center",
              },
              label: {
                fontSize: "12px",
                lineHeight: "14px",
              },
              container: {
                width: "100%",
                display: "flex",
                padding: "12px",
                alignItems: "center",
                background: "#FFFFFF",
                borderRadius: "28px",
                justifyContent: "space-around",
              },
              indicator: {
                mode: "Bubble",
                size: 36,
                color: "#096d70",
                thickness: 6,
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
              elements: {},
              available: false,
              container: {
                width: 278,
                height: 56,
              },
              timestamp: 1766731247604,
              description:
                "Fallback metrics for Bottom Navigation (no live measurement captured).",
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
              description: "DOM classes used by web builder for Bottom Navigation.",
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
              value: 28,
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
