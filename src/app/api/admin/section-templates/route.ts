import { requireAdmin } from "@/lib/api-auth";
import { ensureAppSettings, prisma } from "@/lib/db";
import { HSK_CATEGORIES, type HskCategoryId } from "@/lib/hsk-levels";
import {
  parseSectionTemplates,
  presetTemplatesForSection,
  serializeSectionTemplates,
  type SectionStudyOptions,
} from "@/lib/section-templates";
import { defaultStudyOptionsForSection } from "@/lib/study-options";
import { NextResponse } from "next/server";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  await ensureAppSettings();
  const settings = await prisma.appSetting.findUniqueOrThrow({ where: { id: "default" } });
  const saved = parseSectionTemplates(settings.sectionTemplates);

  const sections: Record<
    string,
    {
      frontTemplate: string;
      backTemplate: string;
      cardCss: string;
      studyOptions: SectionStudyOptions;
      isCustom: boolean;
    }
  > = {};

  for (const cat of HSK_CATEGORIES) {
    const custom = saved[cat.id];
    const preset = presetTemplatesForSection(cat.id);
    sections[cat.id] = {
      frontTemplate: custom?.frontTemplate ?? preset.frontTemplate,
      backTemplate: custom?.backTemplate ?? preset.backTemplate,
      cardCss: custom?.cardCss ?? preset.cardCss,
      studyOptions: {
        ...defaultStudyOptionsForSection(cat.id),
        ...(custom?.studyOptions ?? {}),
      },
      isCustom: !!custom,
    };
  }

  return NextResponse.json({ sections, saved: Object.keys(saved) });
}

export async function PATCH(req: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = (await req.json()) as {
    section?: string;
    frontTemplate?: string;
    backTemplate?: string;
    cardCss?: string;
    studyOptions?: SectionStudyOptions;
    reset?: boolean;
  };

  const section = body.section?.trim() as HskCategoryId | undefined;
  if (!section || !HSK_CATEGORIES.some((c) => c.id === section)) {
    return NextResponse.json({ error: "Mục học không hợp lệ" }, { status: 400 });
  }

  await ensureAppSettings();
  const settings = await prisma.appSetting.findUniqueOrThrow({ where: { id: "default" } });
  const map = parseSectionTemplates(settings.sectionTemplates);

  if (body.reset) {
    delete map[section];
  } else {
    const prev = map[section];
    map[section] = {
      frontTemplate: body.frontTemplate ?? prev?.frontTemplate ?? presetTemplatesForSection(section).frontTemplate,
      backTemplate: body.backTemplate ?? prev?.backTemplate ?? presetTemplatesForSection(section).backTemplate,
      cardCss: body.cardCss ?? prev?.cardCss ?? presetTemplatesForSection(section).cardCss,
      studyOptions: body.studyOptions ?? prev?.studyOptions ?? defaultStudyOptionsForSection(section),
    };
  }

  await prisma.appSetting.update({
    where: { id: "default" },
    data: { sectionTemplates: serializeSectionTemplates(map) },
  });

  const preset = presetTemplatesForSection(section);
  return NextResponse.json({
    ok: true,
    section,
    template: map[section] ?? preset,
    isCustom: !!map[section],
  });
}
