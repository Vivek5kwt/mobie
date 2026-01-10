const authLayoutFallback = {
  page: {
    name: "Signin/Create Account",
    handle: "signincreate-account",
  },
  sections: [
    {
      type: "object",
      title: "Forgot Password Component Schema",
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
                pb: 30,
                pl: 16,
                pr: 16,
                pt: 30,
                bgColor: "#ffffff",
                borderLine: "all",
                paddingTop: 60,
                titleColor: "#027579",
                borderColor: "#ffffff",
                cardBgColor: "#FFFFFF",
                paddingLeft: 20,
                borderRadius: 0,
                headlineBold: true,
                headlineText: "Forgot Passwordjjj?",
                paddingRight: 30,
                borderCorners: 0,
                buttonBgColor:
                  "linear-gradient(180deg, rgba(51, 184, 196, 0.2628) 0%, rgba(9, 170, 185, 0.36) 98.73%)",
                headlineColor: "#027579",
                paddingBottom: 60,
                headlineItalic: false,
                buttonTextColor: "rgba(5, 106, 109, 1)",
                cardBorderColor: "#0c9297",
                headlineFontSize: 24,
                buttonBorderColor: "#0c9297",
                headlineUnderline: false,
                headlineFontFamily: "Inter",
                headlineFontWeight: "Bold",
                resetPasswordTitle: "Reset Password Link",
                headlineAutoUppercase: false,
                headlineStrikethrough: false,
                resetPasswordButtonText: "Forgot Password?",
              },
            },
            presentation: {
              type: "object",
              properties: {
                css: {
                  type: "object",
                  value: {},
                },
                metrics: {
                  type: "object",
                  value: null,
                },
              },
            },
          },
        },
        component: {
          const: "forgot_password",
        },
      },
    },
  ],
  title: "App Page Layout DSL",
  $schema: "http://json-schema.org/draft-07/schema#",
  description:
    "Dynamic layout DSL generated from the current canvas. Each section keeps its CSS/class/metrics snapshot and overlays user-edited props.",
};

export default authLayoutFallback;
