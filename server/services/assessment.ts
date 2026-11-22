import { MlPredictionResult } from '../../ml/inference/classifier';
import { LinguisticAnalysisResult } from './linguistic';
import type { GeminiAnalysisOutput } from './geminiService';
import type { EvidenceStanceSummary } from './evidenceService';

export type AssessmentLabel =
  | 'LIKELY_CREDIBLE'
  | 'POTENTIALLY_MISLEADING'
  | 'INSUFFICIENT_EVIDENCE'
  | 'NEEDS_VERIFICATION'
  | 'ANALYSIS_UNAVAILABLE';

export type SimpleVerdict = 'likely_true' | 'likely_fake' | 'unverified';

export interface AssessmentOutcome {
  label: AssessmentLabel;
  display_label: string;
  simple_verdict: SimpleVerdict;
  simple_result_title: string;
  simple_why: string;
  simple_advice: string;
  reason: string;
  limitations: string[];
}

function defaultSimpleCopy(
  verdict: SimpleVerdict,
  lang: 'en' | 'hi',
  evidenceAvailable: boolean,
  geminiAvailable: boolean,
  hasRiskSignals: boolean,
  isShort: boolean
): { title: string; why: string; advice: string } {
  const methodPhraseEn = geminiAvailable ? 'AI and text pattern checks' : 'text and writing-pattern checks';
  const methodPhraseHi = geminiAvailable ? 'AI और भाषा विश्लेषण' : 'पाठ और लेखन-शैली की जांच';

  if (lang === 'hi') {
    if (verdict === 'likely_true') {
      return {
        title: 'यह खबर सही प्रतीत होती है',
        why: evidenceAvailable
          ? 'जांची गई जानकारी और भाषा के संकेतों के आधार पर यह खबर विश्वसनीय प्रतीत होती है, और इसमें भ्रामक दावों के मजबूत संकेत नहीं मिले।'
          : `लेख की भाषा संतुलित और तथ्यात्मक प्रतीत होती है, और इसमें भ्रामक प्रचार के संकेत नहीं मिले। हालांकि, लाइव इंटरनेट स्रोतों से इसकी स्वतंत्र पुष्टि उपलब्ध नहीं थी (यह परिणाम ${methodPhraseHi} पर आधारित है)।`,
        advice: 'किसी भी महत्वपूर्ण खबर को आगे साझा करने से पहले विश्वसनीय समाचार संस्थानों या आधिकारिक वेबसाइट से एक बार पुष्टि जरूर करें।',
      };
    }
    if (verdict === 'likely_fake') {
      return {
        title: 'यह खबर भ्रामक या झूठी प्रतीत होती है',
        why: hasRiskSignals
          ? 'इस संदेश में सनसनीखेज, बिना प्रमाण वाले या गुमराह करने वाले शब्दों का उपयोग किया गया है, जो अक्सर झूठी या भ्रामक खबरों में देखे जाते हैं।'
          : 'उपलब्ध जानकारी और जांच में इस खबर के मुख्य दावे संदिग्ध या असत्य प्रतीत होते हैं।',
        advice: 'जब तक आप किसी विश्वसनीय समाचार स्रोत या आधिकारिक घोषणा से इसकी पुष्टि न कर लें, तब तक इसे किसी को फॉरवर्ड या शेयर न करें।',
      };
    }
    return {
      title: 'हम इस खबर की पुष्टि नहीं कर सके',
      why: isShort
        ? 'यह संदेश बहुत छोटा है या इसमें पूरी जानकारी नहीं है, इसलिए केवल इस आधार पर यह तय नहीं किया जा सकता कि यह सच है या झूठ।'
        : evidenceAvailable
          ? 'उपलब्ध स्रोतों में इस दावे को पूरी तरह सही या गलत साबित करने के लिए पर्याप्त जानकारी नहीं मिली।'
          : `लाइव वेब स्रोतों से जांच उपलब्ध नहीं होने के कारण हम इस दावे की स्वतंत्र पुष्टि नहीं कर सके (यह परिणाम ${methodPhraseHi} पर आधारित है)।`,
      advice: 'इस जानकारी पर भरोसा करने या इसे साझा करने से पहले सरकारी वेबसाइट, आधिकारिक बयान या प्रतिष्ठित समाचार चैनलों पर जांच करें।',
    };
  }

  if (verdict === 'likely_true') {
    return {
      title: 'This news appears to be true',
      why: evidenceAvailable
        ? 'Based on the sources checked and how the report is written, this news appears genuine with no strong signs of manipulation.'
        : `The article is written in a clear, factual style without warning signs of clickbait or manipulation. Note that live web source verification was not available, so this result is based on ${methodPhraseEn} only.`,
      advice: 'Important news is always worth double-checking with trusted news organizations or official announcements before sharing.',
    };
  }
  if (verdict === 'likely_fake') {
    return {
      title: 'This news appears to be fake or misleading',
      why: hasRiskSignals
        ? 'This message uses alarming wording, unverified claims, or urgent pressure to share—patterns commonly found in false or misleading posts.'
        : 'This claim appears to contradict reliable facts or lacks credible support.',
      advice: 'Do not share or forward this message until you confirm it through trusted news outlets or official websites.',
    };
  }
  return {
    title: 'We could not verify this news',
    why: isShort
      ? 'This text is too short or missing key details to confirm whether it is true or fake.'
      : evidenceAvailable
        ? 'We could not find enough reliable evidence in the sources checked to confirm whether the main claim is true or fake.'
        : `Live web source verification was unavailable, and we do not have enough reliable information to confirm whether this claim is true or fake (this check used ${methodPhraseEn} only).`,
    advice: 'Check trusted news organizations, official government websites, or fact-checking portals before believing or sharing this.',
  };
}

export function computeCautiousAssessment(
  ml: MlPredictionResult,
  linguistic: LinguisticAnalysisResult,
  evidenceAvailable: boolean,
  geminiData: GeminiAnalysisOutput | null = null,
  outputLanguage: 'en' | 'hi' = 'en',
  evidenceStance: EvidenceStanceSummary | null = null
): AssessmentOutcome {
  const limitations = [
    'This tool helps readers spot warning signs and check claims, but it is not a final authority on truth.',
  ];

  if (linguistic.is_short_input) {
    limitations.push('The text is short or headline-only, so important context may be missing.');
  }
  if (!evidenceAvailable) {
    limitations.push(
      geminiData
        ? 'Live web source verification was unavailable; this result is based on AI and pattern analysis only.'
        : 'Live web source verification was unavailable; this result is based on text and writing-pattern checks only.'
    );
  }

  const highRiskLinguisticCount =
    linguistic.sensationalism_indicators.length +
    linguistic.certainty_language.filter((c) => c.severity === 'high').length +
    linguistic.attribution_quality.length;

  const mlSuggestsFake =
    ml.available && ml.predicted_class === 'misleading_or_sensational' && (ml.score ?? 0) >= 0.65;
  const mlSuggestsCredible =
    ml.available && ml.predicted_class === 'credible_reporting' && (ml.score ?? 0) >= 0.65;

  const evidenceDebunked = Boolean(
    evidenceStance &&
      evidenceStance.contradictingCount >= 1 &&
      (evidenceStance.authoritativeDebunk ||
        evidenceStance.contradictingCount >= 2 ||
        highRiskLinguisticCount >= 1 ||
        mlSuggestsFake)
  );
  const evidenceStronglySupported = Boolean(
    evidenceStance &&
      evidenceStance.contradictingCount === 0 &&
      evidenceStance.supportingCount >= 2 &&
      evidenceStance.authoritativeSupport
  );

  let verdict: SimpleVerdict = 'unverified';
  let label: AssessmentLabel = 'NEEDS_VERIFICATION';
  let displayLabel = 'Unverified';

  if (geminiData) {
    if (
      evidenceDebunked ||
      geminiData.verdict === 'likely_fake' ||
      (mlSuggestsFake && highRiskLinguisticCount >= 1) ||
      highRiskLinguisticCount >= 2
    ) {
      verdict = 'likely_fake';
      label = 'POTENTIALLY_MISLEADING';
      displayLabel = outputLanguage === 'hi' ? 'संभवतः झूठी / भ्रामक' : 'Likely Fake / Misleading';
    } else if (
      (geminiData.verdict === 'likely_true' || evidenceStronglySupported) &&
      highRiskLinguisticCount === 0 &&
      !mlSuggestsFake &&
      !(evidenceStance && evidenceStance.contradictingCount > 0)
    ) {
      verdict = 'likely_true';
      label = 'LIKELY_CREDIBLE';
      displayLabel = outputLanguage === 'hi' ? 'संभवतः सही' : 'Likely True';
    } else {
      verdict = 'unverified';
      label = linguistic.is_short_input ? 'INSUFFICIENT_EVIDENCE' : 'NEEDS_VERIFICATION';
      displayLabel = outputLanguage === 'hi' ? 'अपुष्ट (पुष्टि नहीं हो सकी)' : 'Unverified';
    }
  } else {
    const positiveTransparencyCount = linguistic.transparency_checks.filter((c) => c.detected).length;
    const strongMlCredible =
      ml.available &&
      ml.predicted_class === 'credible_reporting' &&
      (ml.score ?? 0) >= 0.78 &&
      highRiskLinguisticCount === 0 &&
      linguistic.loaded_language.length === 0 &&
      !linguistic.is_short_input &&
      positiveTransparencyCount >= 2 &&
      !(evidenceStance && evidenceStance.contradictingCount > 0);

    // Fallback when Gemini is unavailable
    if (evidenceDebunked) {
      verdict = 'likely_fake';
      label = 'POTENTIALLY_MISLEADING';
      displayLabel = outputLanguage === 'hi' ? 'संभवतः झूठी / भ्रामक' : 'Likely Fake / Misleading';
    } else if (evidenceStronglySupported && highRiskLinguisticCount === 0 && linguistic.loaded_language.length === 0) {
      verdict = 'likely_true';
      label = 'LIKELY_CREDIBLE';
      displayLabel = outputLanguage === 'hi' ? 'संभवतः सही' : 'Likely True';
    } else if (linguistic.word_count < 6 && highRiskLinguisticCount === 0) {
      verdict = 'unverified';
      label = 'INSUFFICIENT_EVIDENCE';
      displayLabel = outputLanguage === 'hi' ? 'अपुष्ट (पुष्टि नहीं हो सकी)' : 'Unverified';
    } else if (
      highRiskLinguisticCount >= 1 ||
      (ml.available && ml.predicted_class === 'misleading_or_sensational' && (ml.score ?? 0) >= 0.45)
    ) {
      verdict = 'likely_fake';
      label = 'POTENTIALLY_MISLEADING';
      displayLabel = outputLanguage === 'hi' ? 'संभवतः झूठी / भ्रामक' : 'Likely Fake / Misleading';
    } else if (highRiskLinguisticCount === 0 && linguistic.loaded_language.length === 0 && linguistic.word_count >= 6) {
      verdict = 'likely_true';
      label = 'LIKELY_CREDIBLE';
      displayLabel = outputLanguage === 'hi' ? 'संभवतः सही' : 'Likely True';
    } else {
      verdict = 'unverified';
      label = 'NEEDS_VERIFICATION';
      displayLabel = outputLanguage === 'hi' ? 'अपुष्ट (पुष्टि नहीं हो सकी)' : 'Unverified';
    }
  }

  const fallbackCopy = defaultSimpleCopy(
    verdict,
    outputLanguage,
    evidenceAvailable,
    Boolean(geminiData),
    highRiskLinguisticCount > 0 || mlSuggestsFake || evidenceDebunked,
    linguistic.is_short_input
  );

  // Use Gemini's plain explanation only if verdict aligns with our safeguarded final verdict
  const useGeminiCopy = Boolean(geminiData && geminiData.verdict === verdict && geminiData.simple_why.trim().length > 10);

  const simpleResultTitle = useGeminiCopy ? geminiData!.simple_result_title : fallbackCopy.title;
  let simpleWhy = useGeminiCopy ? geminiData!.simple_why : fallbackCopy.why;
  const simpleAdvice = useGeminiCopy ? geminiData!.simple_advice : fallbackCopy.advice;

  if (evidenceDebunked && verdict === 'likely_fake' && !useGeminiCopy) {
    simpleWhy =
      outputLanguage === 'hi'
        ? 'जांचे गए लाइव वेब स्रोतों और फैक्ट-चेक रिपोर्ट्स में इस दावे को गलत, भ्रामक या निराधार बताया गया है।'
        : 'Live web sources and fact-checking reports consulted for this claim directly contradict it or identify it as false, a hoax, or unsubstantiated.';
  }

  const extraEn = geminiData
    ? ' Live web verification was unavailable, so this check is based on AI and text pattern analysis only.'
    : ' Live web verification was unavailable, so this check is based on text and writing-pattern checks only.';
  const extraHi = geminiData
    ? ' लाइव वेब स्रोतों से जांच उपलब्ध नहीं थी, इसलिए यह परिणाम केवल AI और भाषा विश्लेषण पर आधारित है।'
    : ' लाइव वेब स्रोतों से जांच उपलब्ध नहीं थी, इसलिए यह परिणाम केवल पाठ और लेखन-शैली की जांच पर आधारित है।';

  if (!evidenceAvailable && outputLanguage === 'en' && !simpleWhy.toLowerCase().includes('live') && !simpleWhy.toLowerCase().includes('internet') && !simpleWhy.toLowerCase().includes('source')) {
    simpleWhy += extraEn;
  }
  if (!evidenceAvailable && outputLanguage === 'hi' && !simpleWhy.includes('लाइव') && !simpleWhy.includes('इंटरनेट')) {
    simpleWhy += extraHi;
  }

  return {
    label,
    display_label: displayLabel,
    simple_verdict: verdict,
    simple_result_title: simpleResultTitle,
    simple_why: simpleWhy,
    simple_advice: simpleAdvice,
    reason: simpleWhy,
    limitations,
  };
}

export function extractFallbackClaims(text: string): Array<{
  text: string;
  type: 'statistic' | 'event' | 'quote' | 'policy' | 'science' | 'public_figure' | 'other';
  checkability: 'checkable' | 'opinion' | 'vague' | 'prediction' | 'not_checkable';
  claim_status: 'supported' | 'contradicted' | 'unverified' | 'not_checkable';
  search_query: string;
  caveat: string;
}> {
  const sentences = text
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 15 && s.length <= 320);

  const selected = (sentences.length > 0 ? sentences : [text.trim().slice(0, 240)]).slice(0, 4);
  return selected.map((s) => {
    const hasStat = /\b\d+(\.\d+)?\s*(%|percent|million|billion|crore|lakh|\$|₹)\b/i.test(s);
    const hasPolicy = /\b(bill|council|vote|commission|regulation|federal|government|law|ministry)\b|(सरकार|मंत्रालय|कानून)/i.test(s);
    const hasScience = /\b(study|researchers|journal|vaccine|climate|temperature|telescope|hospital)\b|(अध्ययन|वैज्ञानिक|अस्पताल)/i.test(s);
    const type = hasStat ? 'statistic' : hasScience ? 'science' : hasPolicy ? 'policy' : 'event';
    const words = s
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .slice(0, 8)
      .join(' ');
    return {
      text: s,
      type,
      checkability: 'checkable',
      claim_status: 'unverified',
      search_query: words,
      caveat: 'Check this specific statement against official announcements or trusted news reports.',
    };
  });
}

export const DEMO_ARTICLES = [
  {
    id: 'demo-credible-1',
    title: 'City Council Approves $42M Transit Repair Bond After Audit',
    category: 'Public Policy',
    expected_signal: 'Likely True',
    text: 'City council members voted 7 to 4 on Wednesday to approve a $42 million municipal bond for transit infrastructure repairs. According to the city budget office, the funding will prioritize bridge inspections and bus rapid transit lanes along three high-volume corridors beginning in the second quarter. Auditors verified the expenditure figures against quarterly municipal ledger statements, and the agency scheduled a follow-up review in six months.',
  },
  {
    id: 'demo-misleading-1',
    title: 'Shocking Secret Kitchen Spice Cures Heart Disease in 48 Hours',
    category: 'Health Claim',
    expected_signal: 'Likely Fake / Misleading',
    text: 'SHOCKING SECRET doctors do not want you to know! A miracle kitchen spice completely cures chronic heart disease in just 48 hours, and Big Pharma is desperately hiding the truth to protect billion-dollar profits. Anonymous insiders revealed the shocking truth! Share this before they censor and delete it forever!',
  },
  {
    id: 'demo-short-1',
    title: 'Breaking Headline Without Full Details',
    category: 'Breaking News',
    expected_signal: 'Unverified',
    text: 'Central bank officials signal possible policy rate adjustment ahead of next week inflation report.',
  },
  {
    id: 'demo-hindi-1',
    title: 'Hindi Viral Forward Example (मुफ्त लैपटॉप योजना)',
    category: 'Hindi Viral Claim',
    expected_signal: 'Likely Fake / Misleading',
    text: 'चौंकाने वाला बड़ा खुलासा! सरकार सभी नागरिकों को बिल्कुल मुफ्त लैपटॉप और 50,000 रुपये दे रही है। एक वायरल वीडियो और अंदरूनी सूत्रों के मुताबिक आज रात 11 बजे से पहले लिंक पर क्लिक करें। यह 100% सच है, डिलीट होने से पहले इसे तुरंत सभी ग्रुप में शेयर करें!',
  },
];
