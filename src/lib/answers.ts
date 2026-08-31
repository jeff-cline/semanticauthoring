// Deep answer pages, structured for answer engines (AEO).
//
// Each page leads with a direct, quotable answer — the unit an answer engine
// actually extracts — then supports it with substance. Every page is genuine
// content about scholarly practice; none exists purely to hold a link.

export interface Answer {
  slug: string;
  question: string;       // the page's H1 — phrased as a real question
  answer: string;         // direct answer, 40-70 words, quotable standalone
  description: string;    // meta description
  stage?: string;         // journey accent class
  sections: { h: string; p: string[] }[];
  faqs: { q: string; a: string }[];
  related: string[];
}

export const ANSWERS: Answer[] = [
  {
    slug: "what-is-semantic-authoring",
    question: "What is semantic authoring?",
    answer:
      "Semantic authoring is the practice of writing while preserving the meaning-level connections between what you read, what you thought, and what you claim. Rather than treating a document as flat text, it keeps each idea linked to its source, its supporting evidence, and the reasoning that produced it — so an argument can always be traced back to its origins.",
    description:
      "Semantic authoring keeps the connections between sources, ideas, and claims intact while you write, so any argument can be traced back to its evidence.",
    stage: "stage-author",
    sections: [
      { h: "Why flat documents lose the argument", p: [
        "A finished paper shows conclusions but hides how they were reached. The passage that changed your mind, the author who contradicted you, the note you wrote at 2am in your second year — none of it survives in the final document.",
        "That loss is invisible until it matters: when a committee member asks why you favoured one framework over another, or when you return to a chapter two years later and cannot reconstruct your own reasoning.",
      ]},
      { h: "What gets preserved instead", p: [
        "Semantic authoring treats the link as a first-class object. A claim knows which sources support it, which contradict it, and which merely provide context. A paragraph knows which annotation it grew from. A research question knows which reading provoked it.",
        "The writing surface stays calm and readable. The structure lives underneath, available when you need to defend, revise, or extend the work.",
      ]},
      { h: "How it differs from reference management", p: [
        "A reference manager answers 'where did this citation come from?' Semantic authoring answers 'why do I believe this, and what would change my mind?' The first is bibliographic; the second is epistemic.",
        "Both matter. But only one of them survives being asked a hard question in a defense.",
      ]},
    ],
    faqs: [
      { q: "Is semantic authoring the same as structured writing?", a: "No. Structured writing concerns document format — headings, components, reusable blocks. Semantic authoring concerns meaning: which evidence supports which claim, and how an idea evolved." },
      { q: "Does it require special formatting while writing?", a: "No. You write normally. Connections are made by linking sources, notes, and claims as you work, not by marking up prose." },
    ],
    related: ["intellectual-provenance", "how-to-track-research-questions", "ai-and-academic-integrity"],
  },
  {
    slug: "intellectual-provenance",
    question: "What is intellectual provenance in research?",
    answer:
      "Intellectual provenance is the traceable lineage of an idea — the ordered record running from source to highlight, annotation, reflection, connection, research question, argument, draft, feedback, revision, and finally publication. It makes visible how a scholar arrived at a conclusion, rather than only what the conclusion was.",
    description:
      "Intellectual provenance is the traceable record of how an idea developed from a source into a published contribution — and why it matters for academic integrity.",
    stage: "stage-connect",
    sections: [
      { h: "The chain", p: [
        "Provenance is a sequence: source → highlight → annotation → reflection → connection → research question → argument → draft → feedback → revision → publication. Each step has an author, a timestamp, and a relationship to the step before it.",
        "Because it is a sequence of timestamped events, provenance cannot be reconstructed after the fact. Either you captured it as the work happened, or it is gone.",
      ]},
      { h: "Why it matters now", p: [
        "Generative AI has made the question 'who thought this?' genuinely hard to answer. A record that distinguishes what a scholar read, what a machine suggested, what the scholar thought, and what the scholar authored is no longer a nicety — it is the basis of trust.",
        "Provenance answers that question with evidence rather than assurance.",
      ]},
      { h: "What it enables", p: [
        "Defensible arguments, because every claim can produce its supporting and contradicting sources on demand.",
        "Honest revision, because you can see which conclusions rested on evidence you have since reconsidered.",
        "A visible intellectual biography — how your questions changed across years of study.",
      ]},
    ],
    faqs: [
      { q: "Is this the same as version history?", a: "Version history records what a document looked like at points in time. Provenance records why it changed and what evidence drove the change." },
      { q: "Does provenance slow down writing?", a: "It shouldn't. Capture happens as a by-product of normal reading and annotation rather than as a separate documentation task." },
    ],
    related: ["what-is-semantic-authoring", "ai-and-academic-integrity", "how-to-prepare-dissertation-defense"],
  },
  {
    slug: "how-to-track-research-questions",
    question: "How should you track research questions during a doctorate?",
    answer:
      "Track research questions as versioned records rather than lines in a document. Give each one a status, note where it came from, and preserve every earlier phrasing. How a question changed over several years is itself scholarly evidence — and the original wording is often the more revealing one.",
    description:
      "A practical method for tracking doctoral research questions: statuses, origins, version history, and a bank for questions you are not yet pursuing.",
    stage: "stage-synthesize",
    sections: [
      { h: "Questions are not static", p: [
        "The question you defend rarely resembles the question you started with. It narrows, splits, absorbs a framework, or gets abandoned for the better question hiding underneath.",
        "Overwriting the earlier version destroys the record of that development — which is exactly what a committee will ask you to explain.",
      ]},
      { h: "A workable structure", p: [
        "Status: emerging, active, refining, answered, parked, retired. Most questions spend real time in more than one.",
        "Origin: the reading, annotation, conversation, gap, or life experience that produced it. Origin is what lets you explain why the question is yours.",
        "Hierarchy: sub-questions belong to parents. A dissertation is usually one question with three or four children.",
      ]},
      { h: "Keep a bank for what you are not pursuing", p: [
        "Most good questions arrive at the wrong moment. Parking them with a note — rather than deleting them — turns the overflow of a doctorate into the beginning of a research agenda.",
        "Years later, that bank is often the most valuable file a new faculty member owns.",
      ]},
    ],
    faqs: [
      { q: "How many research questions should a dissertation have?", a: "Most have one central question with two to four sub-questions. If you have eight, you likely have two projects." },
      { q: "What if my question changes late?", a: "That is common and not a failure. What matters is being able to show the reasoning that led there — which is why version history is worth keeping." },
    ],
    related: ["what-is-semantic-authoring", "how-to-organize-dissertation-research", "connecting-life-experience-to-research"],
  },
  {
    slug: "how-to-organize-dissertation-research",
    question: "How do you organize dissertation research so it stays usable?",
    answer:
      "Organize by question rather than by folder. Attach every reading, annotation, and note to the research question it serves, so material assembles itself when you write. Filing by course or semester feels tidy but scatters evidence for a single argument across years of unrelated directories.",
    description:
      "Organize dissertation research around your questions rather than folders, so evidence assembles itself when you write your chapters.",
    stage: "stage-read",
    sections: [
      { h: "Why folders fail", p: [
        "Folders assume each item has one home. Research does not work that way — a single article can support your framework, complicate your methodology, and contradict a finding in chapter four.",
        "Filed once, it is findable once. Linked to three questions, it surfaces all three times you need it.",
      ]},
      { h: "Label the relationship, not just the topic", p: [
        "When you save a source, record what it does to your argument: supports, challenges, contradicts, expands, or contextualizes.",
        "Writing a literature review then becomes a matter of reading your own labels rather than re-reading forty PDFs to remember who disagreed with whom.",
      ]},
      { h: "Capture the reflection while it is warm", p: [
        "For each significant annotation, answer four questions: What does this source say? What do I think? Why does it matter? What does it connect to?",
        "Ninety seconds at the moment of reading saves an afternoon of reconstruction later.",
      ]},
    ],
    faqs: [
      { q: "Should I organize by chapter instead?", a: "Chapters change. Questions are more stable, and chapters can be assembled from question-linked material when the structure settles." },
      { q: "When should I start organizing this way?", a: "As early as possible. Retrofitting three years of unlabeled reading is the most common regret doctoral students report." },
    ],
    related: ["how-to-track-research-questions", "literature-review-methods", "how-to-prepare-dissertation-defense"],
  },
  {
    slug: "literature-review-methods",
    question: "What is the difference between summarizing and synthesizing literature?",
    answer:
      "Summarizing reports what each source said, one after another. Synthesizing organizes sources around ideas — showing where they agree, where they conflict, what is missing, and what you conclude. A summary is a list of authors; a synthesis is an argument that uses authors as evidence.",
    description:
      "The difference between summarizing and synthesizing literature, and a practical method for moving from collected sources to an original position.",
    stage: "stage-synthesize",
    sections: [
      { h: "The tell-tale sign", p: [
        "If your paragraphs begin with author names — 'Smith (2019) found… Jones (2021) argued…' — you are summarizing. If they begin with ideas, and authors appear as support, you are synthesizing.",
        "The structural fix is to make the concept the subject of the sentence and the citation the evidence.",
      ]},
      { h: "Build the matrix first", p: [
        "Put sources down the rows and dimensions across the columns: theoretical framework, population, method, key finding, limitation.",
        "Patterns become visible immediately — three studies agreeing on a population but disagreeing on measurement is a research gap you can see rather than guess at.",
      ]},
      { h: "Track contradictions deliberately", p: [
        "Contradictory findings are the most useful material in a review and the most commonly buried. A review that only cites agreement reads as incurious, and a committee will notice.",
        "Recording what challenges your position, as you encounter it, means the defense question has already been answered in the text.",
      ]},
    ],
    faqs: [
      { q: "How many sources does a literature review need?", a: "There is no correct number. Coverage of the relevant conversation matters more than volume, and disciplines differ widely." },
      { q: "How do I find a research gap?", a: "Gaps usually appear as patterns in a synthesis matrix: an unstudied population, an untested method, an unreplicated finding, or a contradiction nobody has resolved." },
    ],
    related: ["how-to-organize-dissertation-research", "how-to-track-research-questions", "what-is-semantic-authoring"],
  },
  {
    slug: "how-to-prepare-dissertation-defense",
    question: "How do you prepare for a dissertation defense?",
    answer:
      "Prepare by auditing your own argument before the committee does. For each major claim, know the supporting evidence, the contradicting evidence, the methodological weakness, and your honest response. Most difficult defense questions target places where the author already sensed a soft spot and hoped it would not come up.",
    description:
      "A method for dissertation defense preparation: audit each claim for supporting and contradicting evidence, and rehearse honest answers to the weakest points.",
    stage: "stage-review",
    sections: [
      { h: "Audit claim by claim", p: [
        "Walk your dissertation and list every substantive claim. For each: what supports it, what contradicts it, how strong is that evidence, and where is it vulnerable?",
        "The claims where you cannot answer quickly are precisely the ones to prepare. Your discomfort is a reliable index of committee interest.",
      ]},
      { h: "Expect questions by category", p: [
        "Theoretical, methodological, statistical, epistemological, ethical, literature coverage, limitations, generalizability, contribution, and future research.",
        "Prepare at least one honest answer in each category. 'That is a limitation, and here is how I would address it in future work' is a strong answer, not a weak one.",
      ]},
      { h: "Rehearse being wrong", p: [
        "The failure mode in defenses is not ignorance — it is defensiveness. A candidate who concedes a genuine limitation gracefully reads as a scholar; one who argues every point reads as brittle.",
        "Practice conceding. It is a skill, and it is the one most often untested before the day.",
      ]},
    ],
    faqs: [
      { q: "What is the most common defense question?", a: "Some form of 'why this method?' — a request to justify methodology against the alternatives you did not choose." },
      { q: "Should I memorize answers?", a: "No. Know your evidence well enough to reason in the room. Memorized answers fail as soon as the question is phrased unexpectedly." },
    ],
    related: ["intellectual-provenance", "how-to-organize-dissertation-research", "literature-review-methods"],
  },
  {
    slug: "connecting-life-experience-to-research",
    question: "Should personal experience inform your research questions?",
    answer:
      "Yes — and making the connection explicit strengthens rather than compromises the work. Most durable research questions come from lived experience. Naming that origin lets you examine your assumptions deliberately, which is more rigorous than pretending to a neutrality no researcher actually has.",
    description:
      "Why lived experience belongs in your research reflection, and how to connect formative experiences to the questions driving your scholarship.",
    stage: "stage-connect",
    sections: [
      { h: "The question behind the question", p: [
        "Ask a doctoral student why they study what they study and the first answer is usually a gap in the literature. The second answer, offered more quietly, is usually a person, a loss, a job, or a place.",
        "The second answer is the one that sustains someone through year four.",
      ]},
      { h: "Naming it is a rigor practice", p: [
        "Unexamined motivation shapes research invisibly — in what you notice, what you dismiss, and which findings feel obviously right.",
        "Mapping experiences to questions makes those influences examinable. Qualitative traditions have called this reflexivity for decades; it belongs in quantitative work too.",
      ]},
      { h: "Keep it private by default", p: [
        "This material is sensitive and should default to private, shared only if and when you choose — for example in a positionality statement.",
        "Its primary value is to you: understanding why you are asking is what lets you ask a better version of the question.",
      ]},
    ],
    faqs: [
      { q: "Does personal motivation bias research?", a: "Unexamined motivation does. Named and examined motivation is a recognized rigor practice, particularly in qualitative traditions." },
      { q: "Do I have to disclose this in my dissertation?", a: "Not necessarily. Many disciplines welcome a positionality statement, but the reflection is valuable even when it stays private." },
    ],
    related: ["how-to-track-research-questions", "what-is-semantic-authoring", "scholarly-writing-practice"],
  },
  {
    slug: "ai-and-academic-integrity",
    question: "How should scholars use AI without compromising academic integrity?",
    answer:
      "Use AI to find, compare, and organize — never to author. It can surface forgotten notes, compare how authors disagree, and locate contradictions in your library. The line that must stay visible is the difference between what you read, what a machine suggested, what you thought, and what you wrote.",
    description:
      "A defensible standard for using AI in doctoral research: assistance with discovery and organization, never with authorship, and always with provenance preserved.",
    stage: "stage-author",
    sections: [
      { h: "Assistant, not ghostwriter", p: [
        "Legitimate uses: surfacing connections across your own material, rediscovering a note from years ago, comparing theoretical positions, clustering themes, finding contradictions you missed, and helping translate finished scholarship for a public audience.",
        "Illegitimate uses: generating claims you have not verified, producing citations you have not read, and drafting argument you then adopt as your own thinking.",
      ]},
      { h: "The fabrication problem", p: [
        "Language models produce fluent, plausible citations that do not exist. In a scholarly context this is not a quirk — it is a career risk, and it has already ended some.",
        "The defense is structural: never accept a citation that has not resolved against an authoritative source, and prefer 'unable to verify' over a confident guess.",
      ]},
      { h: "Keep the record", p: [
        "Every AI-touched item should carry a marker: what model, when, from what prompt, and whether a human verified it.",
        "That record turns an uncomfortable question — 'did you write this?' — into one you can answer with evidence.",
      ]},
    ],
    faqs: [
      { q: "Can AI write my literature review?", a: "It should not. It can help you organize and compare sources you have actually read; the synthesis and the argument must be yours." },
      { q: "Why do AI tools invent citations?", a: "They generate statistically plausible text, and a plausible-looking citation is easy to produce. Always verify against an authoritative index before citing." },
    ],
    related: ["intellectual-provenance", "what-is-semantic-authoring", "how-to-prepare-dissertation-defense"],
  },
  {
    slug: "scholarly-writing-practice",
    question: "How do you build a sustainable scholarly writing practice?",
    answer:
      "Build it around small, repeatable sessions connected to material you have already gathered, rather than rare long days of heroic effort. The scholars who finish are usually not the fastest writers — they are the ones who removed the friction between reading and drafting.",
    description:
      "How to build a scholarly writing practice that survives a multi-year doctorate: short sessions, low friction, and one meaningful action per day.",
    stage: "stage-author",
    sections: [
      { h: "The friction is the problem", p: [
        "Most stalled writing is not a motivation failure. It is the twenty minutes of hunting for the right quote, the half-remembered source, and the note that was definitely somewhere.",
        "Reduce that gap and the writing largely takes care of itself.",
      ]},
      { h: "One meaningful action a day", p: [
        "Ask what single scholarly action would move the work forward today, and do that one thing. A paragraph, one source properly annotated, one section restructured.",
        "Over a doctorate, daily small motion outperforms occasional intensity — and it does considerably less damage to the person doing it.",
      ]},
      { h: "Track the process, not only the product", p: [
        "Word counts measure output but not understanding. Some of the most productive days produce no new prose at all — the day you finally see why two authors disagree changes everything downstream.",
        "A short daily reflection captures that progress, and makes it visible on the days when it does not feel like progress.",
      ]},
    ],
    faqs: [
      { q: "How many hours a day should I write?", a: "Consistency matters more than duration. Ninety focused minutes most days beats an eight-hour session once a fortnight." },
      { q: "What if I have nothing to write?", a: "Usually a signal to return to reading or synthesis. Writing blocks are often evidence problems rather than writing problems." },
    ],
    related: ["how-to-organize-dissertation-research", "connecting-life-experience-to-research", "literature-review-methods"],
  },
];

export const bySlug = (s: string) => ANSWERS.find((a) => a.slug === s);
