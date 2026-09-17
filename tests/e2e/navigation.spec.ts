import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/aivah/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (
      path.endsWith("/agents") &&
      route.request().method() === "POST"
    ) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      await route.fulfill({
        json: {
          statusCode: 200,
          results: { chat_bot_id: 3, name: "New agent" },
        },
      });
      return;
    }
    const results = path.endsWith("/agents/2")
      ? {
          chat_bot_id: 2,
          name: "Video presenter",
          isPresentationAgent: true,
          chatBotContents: [
            {
              chatBotContentId: 201,
              storageUrl: "/sample.mp4",
              chatBotContentSlides: [
                {
                  chatBotContentSlideId: 1,
                  slideOrder: 0,
                  context: "Opening",
                },
                {
                  chatBotContentSlideId: 2,
                  slideOrder: 46,
                  context: "The main topic",
                },
              ],
            },
          ],
        }
      : path.endsWith("/agents/3")
        ? {
            chat_bot_id: 3,
            name: "Presenter",
            isPresentationAgent: true,
            chatBotContents: [
              { chatBotContentId: 101, storageUrl: "/sample.pdf" },
            ],
          }
        : path.endsWith("/agents/1")
          ? {
              chat_bot_id: 1,
              name: "Support agent",
              isPresentationAgent: false,
              chatBotContents: [],
            }
          : path.endsWith("/sessions/token")
            ? {
                token: "test-token",
                url: "ws://127.0.0.1:1",
                roomName: "test-room",
              }
            : path.endsWith("/agents")
              ? {
                  data: [
                    {
                      chat_bot_id: 1,
                      name: "Support agent",
                      isPresentationAgent: false,
                      trainingStatus: "completed",
                    },
                    {
                      chat_bot_id: 2,
                      name: "Video presenter",
                      isPresentationAgent: true,
                      trainingStatus: "completed",
                    },
                    {
                      chat_bot_id: 3,
                      name: "Presenter",
                      isPresentationAgent: true,
                      trainingStatus: "completed",
                    },
                  ],
                  total: 3,
                  page: 1,
                  limit: 50,
                }
              : path.includes("llm-models")
                ? [
                    {
                      label: "Standard",
                      options: [
                        {
                          value: 1,
                          label: "Model one",
                          environment: "Standard",
                        },
                        {
                          value: 2,
                          label: "Model two",
                          environment: "Standard",
                        },
                      ],
                    },
                  ]
                : path.endsWith("/voices")
                  ? {
                      groups: {
                        Standard: [
                          { voiceId: 1, voiceName: "Voice one" },
                          { voiceId: 2, voiceName: "Voice two" },
                        ],
                      },
                    }
                  : path.endsWith("/characters")
                    ? { avatars: [], total: 0, page: 1, limit: 50 }
                    : path.endsWith("/backgrounds")
                      ? {
                          backgrounds: [
                            {
                              id: 10,
                              avatar_name: "Office",
                              url: "/office.jpg",
                              mediaType: "image",
                            },
                            {
                              id: 11,
                              avatar_name: "Moving office",
                              url: "/office.webm",
                              mediaType: "video",
                            },
                          ],
                          total: 2,
                          page: 1,
                          limit: 50,
                        }
                      : { backgrounds: [], total: 0, page: 1, limit: 50 };
    await route.fulfill({ json: { statusCode: 200, results } });
  });
});

async function startSession(
  page: import("@playwright/test").Page,
  options: { agentName?: string; message?: string; presentation?: boolean } = {},
) {
  const {
    agentName = "Support agent",
    message = "Hello there",
    presentation = false,
  } = options;
  await page.goto("/new-chat");
  await page.getByRole("button", { name: "Choose agent" }).click();
  if (presentation) {
    await page.getByRole("button", { name: "Presentation", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "Standard", exact: true }).click();
  }
  await page.getByRole("button", { name: agentName, exact: true }).click();
  if (!presentation) {
    await page.getByPlaceholder("Ask anything").fill(message);
    await page.getByRole("button", { name: "Start conversation" }).click();
  } else {
    await page.getByRole("button", { name: "Start presentation" }).click();
  }
  await expect(page).toHaveURL(/\/chat\/?$/);
}

test("redirects /chat to new-chat without an active session", async ({
  page,
}) => {
  await page.goto("/chat");
  await expect(page).toHaveURL(/\/new-chat\/?$/);
});

test("opens the live chat route after starting a session", async ({ page }) => {
  await startSession(page);
  await expect(page.getByText("Support agent").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Support agent" }),
  ).toBeVisible();
});

test("matches the active chat composer controls", async ({ page }) => {
  await startSession(page);

  await expect(page.getByText("Text and microphone only")).toHaveCount(0);
  const textarea = page.getByPlaceholder("Ask anything");
  await expect(textarea).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Choose model" }),
  ).toContainText("Model one");
  await expect(
    page.getByRole("button", { name: "Choose voice" }),
  ).toContainText("Voice one");
  await expect(
    page.getByRole("button", { name: "Support agent" }),
  ).toHaveAttribute("aria-disabled", "true");
  await expect(
    page.getByRole("button", { name: "Toggle microphone" }),
  ).toHaveAttribute("data-variant", "ghost");

  const inputGroup = page.locator('[data-slot="input-group"]');
  await expect(inputGroup).toHaveCSS("border-top-width", "0px");
  const composer = page.locator("form").filter({ has: textarea });
  const restingShadow = await composer.evaluate(
    (element) => getComputedStyle(element).boxShadow,
  );
  await textarea.focus();
  await expect
    .poll(() =>
      composer.evaluate((element) => getComputedStyle(element).boxShadow),
    )
    .toBe(restingShadow);
});

test("keeps presentation, composer, and transcription in separate regions", async ({
  page,
  isMobile,
}) => {
  await startSession(page, {
    agentName: "Presenter",
    presentation: true,
  });
  await expect(
    page.getByRole("heading", { name: "Transcription" }),
  ).toBeVisible();
  await expect(page.getByTestId("presentation-scene")).toBeVisible();
  const stage = page.getByTestId("presentation-stage");
  await expect(stage).toBeVisible();
  const hidePanel = page.getByRole("button", {
    name: "Hide transcription panel",
  });
  await expect(hidePanel).toHaveAttribute("aria-pressed", "true");
  await hidePanel.click();
  await expect(page.getByTestId("transcription-panel")).toHaveCount(0);
  const showPanel = page.getByRole("button", {
    name: "Show transcription panel",
  });
  await expect(showPanel).toHaveAttribute("aria-pressed", "false");
  await showPanel.click();
  await expect(page.getByTestId("transcription-panel")).toBeVisible();

  const composer = page.getByTestId("presentation-composer");
  const panel = page.getByTestId("transcription-panel");
  const [stageBox, composerBox, panelBox] = await Promise.all([
    stage.boundingBox(),
    composer.boundingBox(),
    panel.boundingBox(),
  ]);
  expect(stageBox).not.toBeNull();
  expect(composerBox).not.toBeNull();
  expect(panelBox).not.toBeNull();

  if (isMobile) {
    expect(panelBox!.y).toBeGreaterThanOrEqual(
      composerBox!.y + composerBox!.height - 1,
    );
  } else {
    expect(panelBox!.x).toBeGreaterThanOrEqual(
      stageBox!.x + stageBox!.width - 1,
    );
  }
  expect(composerBox!.y).toBeGreaterThanOrEqual(
    stageBox!.y + stageBox!.height - 1,
  );
});

test("uses agent-controlled video with chapter navigation", async ({
  page,
}) => {
  await startSession(page, {
    agentName: "Video presenter",
    presentation: true,
  });
  await expect(page.getByTestId("presentation-scene")).toBeVisible();
  await expect(page.getByTestId("presentation-stage")).toBeVisible();
  await expect(page.getByTestId("presentation-composer")).toBeVisible();
  await expect(page.getByRole("button", { name: "Lessons" })).toBeVisible();

  const video = page.locator("video");
  await expect(video).toBeVisible();
  await expect(video).toHaveJSProperty("controls", true);
  await expect(video).toHaveJSProperty("paused", true);

  await page.getByRole("button", { name: "Open chapters" }).click();
  await expect(page.getByText("Opening", { exact: true })).toBeVisible();
  await expect(page.getByText("The main topic", { exact: true })).toBeVisible();
  await page.getByText("The main topic", { exact: true }).click();
  await expect(page.getByText("The main topic", { exact: true })).toHaveCount(
    0,
  );

  const stageBox = await page.getByTestId("presentation-stage").boundingBox();
  const videoBox = await video.boundingBox();
  expect(stageBox).not.toBeNull();
  expect(videoBox).not.toBeNull();
  expect(videoBox!.width).toBeGreaterThan(0);
  expect(videoBox!.height).toBeGreaterThan(0);
});

test("navigates the starter kit without recent conversations", async ({
  page,
}) => {
  await page.goto("/new-chat");
  await expect(
    page.getByRole("heading", { name: "How can I help you today?" }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Recent conversations");
});

test("opens agent entries and refreshes agent data", async ({ page }) => {
  await page.goto("/agents");
  await expect(
    page.getByRole("button", { name: "Refresh agents" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Refresh agents" }).click();
  await expect(page.getByRole("link", { name: "View Presenter" })).toBeVisible();
  await page.getByRole("link", { name: "View Presenter" }).click();
  await expect(page).toHaveURL(/\/agents\/3$/);
  await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
});

test("blocks duplicate agent creation and returns to the listing", async ({
  page,
}) => {
  await page.goto("/agents/create");
  await page.getByLabel("Name").fill("New agent");
  await page.getByLabel("Text knowledge").fill("Starter kit guidance.");
  const create = page.getByRole("button", { name: "Create agent" });
  await create.evaluate((button) => (button as HTMLButtonElement).click());
  const pending = page
    .locator('button[type="submit"]')
    .filter({ hasText: "Creating agent…" });
  await expect(pending).toBeDisabled();
  await expect(pending.getByRole("status")).toBeVisible();
  await expect(page).toHaveURL(/\/agents$/);
});

test("offers microphone recording when cloning a voice", async ({ page }) => {
  await page.addInitScript(() => {
    const track = { stop: () => undefined };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => ({
          getTracks: () => [track],
        }),
      },
    });
    class FakeMediaRecorder {
      static isTypeSupported() {
        return true;
      }
      state = "inactive";
      mimeType = "audio/webm";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({
          data: new Blob(["sample"], { type: this.mimeType }),
        });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: FakeMediaRecorder,
    });
  });
  await page.goto("/voices");
  await page.getByRole("button", { name: "Clone voice" }).click();
  await page.getByRole("button", { name: "Record voice" }).click();
  await expect(
    page.getByRole("button", { name: "Stop recording" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(page.getByLabel("Recorded voice sample")).toBeVisible();
  await expect(page.getByLabel("Audio sample")).not.toHaveAttribute(
    "required",
  );
});

test("marks only video backgrounds with a camera icon", async ({ page }) => {
  await page.goto("/characters");
  await page.getByRole("tab", { name: "Backgrounds" }).click();
  await expect(page.getByLabel("Video background")).toHaveCount(1);

  await page.goto("/new-chat");
  await page.getByRole("button", { name: /Character/ }).click();
  await page.getByRole("tab", { name: "Backgrounds" }).click();
  await expect(page.getByLabel("Video background")).toHaveCount(1);
});

test("mobile navigation opens as a sheet", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only assertion");
  await page.goto("/new-chat");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("link", { name: "Characters" })).toBeVisible();
});

test("persists the selected theme", async ({ page }) => {
  await page.goto("/new-chat");
  await page
    .getByRole("button", { name: "Change color theme" })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("shows a safe deployment configuration error", async ({ page }) => {
  await page.unroute("**/api/aivah/**");
  await page.route("**/api/aivah/**", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: {
          code: "CONFIG_MISSING",
          message:
            "This deployment is not configured. Set the server environment.",
        },
      },
    }),
  );
  await page.goto("/new-chat");
  await expect(page.getByText("Couldn't load this page")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("sk_aivah_");
});
