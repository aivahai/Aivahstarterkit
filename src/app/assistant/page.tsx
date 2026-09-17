"use client";

import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  ASSISTANT_PROVIDER_PRESETS,
  type AssistantEditorConfig,
  type AssistantProvider,
} from "@/lib/assistant-config";
import { Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export default function AssistantSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AssistantEditorConfig | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/aivah-assistant/config", {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load assistant config.");
      }
      setConfig(payload.config as AssistantEditorConfig);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Unable to load assistant config.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const preset = useMemo(
    () =>
      config
        ? ASSISTANT_PROVIDER_PRESETS[config.provider]
        : ASSISTANT_PROVIDER_PRESETS["gemini-live"],
    [config],
  );

  const updateProvider = (provider: AssistantProvider) => {
    const next = ASSISTANT_PROVIDER_PRESETS[provider];
    setConfig((current) =>
      current
        ? {
            ...current,
            provider,
            model: next.models.includes(current.model)
              ? current.model
              : next.defaultModel,
            voice: next.voices.includes(current.voice)
              ? current.voice
              : next.defaultVoice,
          }
        : current,
    );
  };

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const response = await fetch("/api/aivah-assistant/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Unable to save assistant config.");
      }
      setConfig(payload.config as AssistantEditorConfig);
      toast.success("Saved to public/aivah-assistant/");
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Unable to save assistant config.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6">
      <PageHeading
        title="Voice assistant"
        description="Edit the files in public/aivah-assistant/. The widget reads assistant.json in the browser; instructions and knowledge are merged server-side at session mint."
        actions={
          <Button onClick={() => void save()} disabled={!config || saving}>
            {saving ? <Spinner className="size-4" /> : <Save className="size-4" />}
            Save
          </Button>
        }
      />

      {loading || !config ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>assistant.json</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>Provider</FieldLabel>
                  <Select
                    value={config.provider}
                    onValueChange={(value) =>
                      updateProvider(value as AssistantProvider)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.entries(ASSISTANT_PROVIDER_PRESETS) as [
                          AssistantProvider,
                          (typeof ASSISTANT_PROVIDER_PRESETS)[AssistantProvider],
                        ][]
                      ).map(([id, item]) => (
                        <SelectItem key={id} value={id}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel>Model</FieldLabel>
                  <Select
                    value={
                      preset.models.includes(config.model)
                        ? config.model
                        : "__custom__"
                    }
                    onValueChange={(value) => {
                      if (value !== "__custom__") {
                        setConfig((current) =>
                          current ? { ...current, model: value } : current,
                        );
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {preset.models.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                      <SelectItem value="__custom__">Custom model…</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    className="mt-2"
                    value={config.model}
                    onChange={(event) =>
                      setConfig((current) =>
                        current
                          ? { ...current, model: event.target.value }
                          : current,
                      )
                    }
                    placeholder={preset.defaultModel}
                  />
                  <FieldDescription>
                    Upstream model id passed to {preset.label}.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel>Voice</FieldLabel>
                  <Select
                    value={
                      preset.voices.includes(config.voice)
                        ? config.voice
                        : "__custom__"
                    }
                    onValueChange={(value) => {
                      if (value !== "__custom__") {
                        setConfig((current) =>
                          current ? { ...current, voice: value } : current,
                        );
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a voice" />
                    </SelectTrigger>
                    <SelectContent>
                      {preset.voices.map((voice) => (
                        <SelectItem key={voice} value={voice}>
                          {voice}
                        </SelectItem>
                      ))}
                      <SelectItem value="__custom__">Custom voice…</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    className="mt-2"
                    value={config.voice}
                    onChange={(event) =>
                      setConfig((current) =>
                        current
                          ? { ...current, voice: event.target.value }
                          : current,
                      )
                    }
                    placeholder={preset.defaultVoice}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Site context</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>instructions.md</FieldLabel>
                  <Textarea
                    rows={10}
                    value={config.instructions}
                    onChange={(event) =>
                      setConfig((current) =>
                        current
                          ? { ...current, instructions: event.target.value }
                          : current,
                      )
                    }
                    placeholder="Who the assistant is and how it should behave on this site."
                  />
                  <FieldDescription>
                    Host brief only — platform safety rules are added by Aivah.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel>knowledge.md</FieldLabel>
                  <Textarea
                    rows={8}
                    value={config.knowledge}
                    onChange={(event) =>
                      setConfig((current) =>
                        current
                          ? { ...current, knowledge: event.target.value }
                          : current,
                      )
                    }
                    placeholder="Product facts, policies, and things the assistant should know."
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
