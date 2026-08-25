import { getSectionPreset } from "@/lib/section-presets";
import type { HskCategoryId } from "@/lib/hsk-levels";

export type SectionTemplateSet = {
  frontTemplate: string;
  backTemplate: string;
  cardCss: string;
};

export type SectionTemplatesMap = Partial<Record<HskCategoryId, SectionTemplateSet>>;

export function presetTemplatesForSection(section: string): SectionTemplateSet {
  const p = getSectionPreset(section);
  return {
    frontTemplate: p.frontTemplate,
    backTemplate: p.backTemplate,
    cardCss: p.cardCss,
  };
}

export function parseSectionTemplates(raw: string | null | undefined): SectionTemplatesMap {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw) as SectionTemplatesMap;
  } catch {
    return {};
  }
}

export function serializeSectionTemplates(map: SectionTemplatesMap): string {
  return JSON.stringify(map);
}

/** Mẫu hiển thị: bộ thẻ riêng → mẫu chung theo mục → preset mặc định */
export function resolveCourseTemplates(
  course: {
    frontTemplate: string | null;
    backTemplate: string | null;
    cardCss: string | null;
    primarySection?: string | null;
  },
  globalTemplates?: SectionTemplatesMap | null,
): SectionTemplateSet {
  const section = course.primarySection ?? "vocabulary";
  const preset = presetTemplatesForSection(section);

  const hasOwn =
    !!course.frontTemplate?.trim() ||
    !!course.backTemplate?.trim() ||
    !!course.cardCss?.trim();

  if (hasOwn) {
    return {
      frontTemplate: course.frontTemplate?.trim() || preset.frontTemplate,
      backTemplate: course.backTemplate?.trim() || preset.backTemplate,
      cardCss: course.cardCss?.trim() || preset.cardCss,
    };
  }

  const global = globalTemplates?.[section as HskCategoryId];
  if (global?.frontTemplate?.trim()) {
    return {
      frontTemplate: global.frontTemplate,
      backTemplate: global.backTemplate?.trim() || preset.backTemplate,
      cardCss: global.cardCss?.trim() || preset.cardCss,
    };
  }

  return preset;
}

export function sampleCardForSection(section: string) {
  if (section === "vocabulary") {
    return {
      front: "爱",
      back: "Yêu, thương",
      pinyin: "ài",
      audioUrl: null as string | null,
      section,
      extraFields: JSON.stringify({
        "Nghĩa hán việt": "Ái",
        "Loại từ": "Động từ",
        "Đặt câu": "爸爸爱妈妈。 / Bàba ài māmā / Ba yêu mẹ.",
      }),
    };
  }

  if (section === "grammar") {
    return {
      front: "是...的",
      back: "Cấu trúc nhấn mạnh",
      pinyin: "shì...de",
      audioUrl: null,
      section,
      extraFields: JSON.stringify({ "VÍ DỤ": "我是昨天来的。 / Wǒ shì zuótiān lái de / Tôi đến hôm qua." }),
    };
  }

  if (section === "sentence_order") {
    return {
      front: "我 / 喜欢 / 学习 / 中文",
      back: "我喜欢学习中文",
      pinyin: "Wǒ xǐhuān xuéxí Zhōngwén",
      audioUrl: null,
      section,
      extraFields: JSON.stringify({ NGHĨA: "Tôi thích học tiếng Trung" }),
    };
  }

  return {
    front: "Bạn khỏe không?",
    back: "你好吗？",
    pinyin: "Nǐ hǎo ma?",
    audioUrl: null,
    section,
    extraFields: JSON.stringify({ "VÍ DỤ": "A: 你好吗？ B: 我很好。" }),
  };
}
