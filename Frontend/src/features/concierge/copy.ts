import {
  AI_PROCESSING_COPY,
  describeAiProcessing,
  describeVoiceProcessing,
} from './aiProcessingCopy';
import type {
  AiProcessingDisclosure,
  ConciergeCheckoutStatus,
  ConciergeLocale,
  ConciergePetSize,
  ConciergeSafetyTask,
  ConciergeSpecies,
  ManagerReviewReason,
  SpeechProcessing,
} from './types';

/** What is answering the chat, as far as the page knows. */
export type GreetingMode = 'model' | 'rules' | 'unknown';

/**
 * Every word the concierge page shows, in English and Chinese.
 *
 * The notices here are not decoration. They carry what the NZ/AU compliance review asked for:
 * saying the guest is talking to an AI, how their information is used and where it is processed,
 * that Wagstay does not save voice recordings (what AWS keeps is set by its own data settings, so
 * it is not promised here), that every request waits for our manager, and that nothing is paid
 * online (the guest pays at the desk after the arrival health check). Change their meaning only
 * with that review in hand.
 *
 * Promises are limited to what the system does today (Fair Trading Act s12A/s13). A stay is
 * called confirmed only once the server confirmed it,
 * and a stay waiting for our manager is never called booked (s9, s11). Wagstay's own rules, such
 * as the vaccines we ask for and the stays our manager checks, are never presented as law (s13(i)).
 */

export type DateProblem = 'end_before_start' | 'in_past' | 'too_long';

export type DetailsField =
  | 'firstName'
  | 'lastName'
  | 'address'
  | 'phone'
  | 'emergencyContactNumber'
  | 'email'
  | 'password'
  | 'accountExists'
  | 'petName'
  | 'dropOffTime'
  | 'pickUpTime'
  | 'termsAccepted'
  | 'vetConsent'
  | 'nameTooLong'
  | 'addressTooLong'
  | 'phoneTooLong'
  | 'breedTooLong';

/**
 * Words decided by what happened rather than written down at the time, so they follow a language
 * switch: a notice kept as a string stayed in the language it was raised in.
 */
export type LocalisedText = (copy: ConciergeCopy) => string;

export interface ConciergeCopy {
  pageTitle: string;
  pageLead: string;
  /** Between the items of a short list: ", " in English, "、" in Chinese. */
  listJoiner: string;
  aiBadge: string;
  talkToPerson: string;
  helpNav: string;
  signIn: string;
  /** The header's sign-in for returning owners; opens the sign-in dialog over the plan. */
  returningSignIn: string;
  /** A signed-in pet parent's way back to their portal. */
  myPetCentre: string;
  documentTitle: Record<'plan' | 'verify' | 'details' | 'done', string>;
  steps: Record<'plan' | 'choose' | 'verify' | 'details' | 'done', string>;
  a11y: { you: string; assistant: string; done: string; selected: string };
  rates: {
    fromLine: (amount: string) => string;
    showAll: string;
    hideAll: string;
    rooms: string;
    food: string;
    extras: string;
  };
  /** Online booking is off for another reason (no room count on this server). */
  bookingOffNotice: string;
  chat: {
    title: string;
    /**
     * The first line in the chat. It says what is answering: a model that can be wrong, or a
     * keyword matcher that only understands simple phrases. Before the server has said which,
     * it says only that this is an automated helper.
     */
    greeting: (mode: GreetingMode) => string;
    placeholder: string;
    send: string;
    sending: string;
    thinking: string;
    rulesMode: string;
    assistantDown: string;
    enterHint: string;
    listening: string;
    /** Where voice-to-text runs, from the server's status; null while it is loading. */
    voiceNotice: (speech: SpeechProcessing | null) => string;
    dictation: { start: string; stop: string; requesting: string; finishing: string };
    dictationErrors: {
      unsupported: string;
      permissionDenied: string;
      noMicrophone: string;
      failed: string;
    };
    retry: string;
    restored: string;
    startOver: string;
    startOverConfirm: string;
    startOverYes: string;
    startOverNo: string;
    stuck: string;
    openChecklist: string;
  };
  answers: {
    groupLabel: string;
    starterDog: string;
    starterCat: string;
    starterSeveral: string;
    boardingYes: string;
    petCount: (count: number, species: 'dog' | 'cat') => string;
    dogAndCat: string;
    somethingElse: string;
    speciesFor: (index: number) => string;
    sizeFor: (index: number) => string;
    chooseDates: string;
    useDates: string;
    datesPreview: (range: string, nights: string) => string;
    medicationQuestion: string;
    /** Asked when some pets already have an answer, such as a saved pet's medication on record. */
    medicationQuestionOthers: string;
    noMedication: string;
    noOtherMedication: string;
    petTakesMedication: (index: number) => string;
    allTakeMedication: string;
    othersTakeMedication: string;
    /** Opens the stay panel from the answer buttons. */
    seeOptions: string;
    /** Hands the form-filling to the assistant; the guest still presses Send. */
    bookForMe: string;
    /** Asks for a repeat of the signed-in parent's last stay; the server recognises the words. */
    sameAsLastTime: string;
    savedPetsTitle: string;
    chipMessage: {
      dogs: (count: number) => string;
      cats: (count: number) => string;
      dogAndCat: string;
      species: (index: number, species: string) => string;
      size: (index: number, size: string) => string;
      dates: (range: string) => string;
      noMedication: string;
      noOtherMedication: string;
      medication: (index: number) => string;
      allMedication: string;
      othersMedication: string;
      savedPet: (name: string) => string;
    };
  };
  privacy: {
    summary: string;
    detailsToggle: string;
    /** The notice's lines; where words are processed comes from the server's status, or null. */
    details: (aiProcessing: AiProcessingDisclosure | null) => string[];
  };
  /** The words for a stay, shared by the stay card, the summaries and the request receipt. */
  stay: {
    dates: string;
    nights: (count: number) => string;
    /** "2 pets", for the one-line summary on the folded stay card. */
    pets: (count: number) => string;
    guests: string;
    /** "Stay": the row that names what was agreed to, built from its contents. */
    chosen: string;
    extras: string;
    none: string;
    ready: string;
    stillNeeded: string;
    medication: string;
    firstStay: string;
    notes: string;
    sizeHint: string;
    dateProblem: Record<DateProblem, string>;
  };
  checklist: {
    title: string;
    hint: string;
    startDate: string;
    endDate: string;
    petCount: string;
    petLabel: (index: number) => string;
    species: string;
    dog: string;
    cat: string;
    other: string;
    size: string;
    small: string;
    medium: string;
    large: string;
    medication: string;
    firstStay: string;
    toggleOpen: string;
    toggleClose: string;
  };
  /** The extras a guest can ask the assistant for, named for the plan summary. */
  extras: {
    walks: string;
    grooming: string;
    playtime: string;
  };
  missing: Record<'service' | 'dates' | 'pets' | 'species' | 'size', string>;
  /** The stay panel: the suggested combos, the builder and the live total. */
  packages: {
    /** The panel's heading and the button that reopens it. */
    title: string;
    lead: string;
    close: string;
    /** The chip under the reply that brought the suggested stays. */
    openChip: string;
    suggestedTitle: string;
    useCombo: string;
    /** On the combo whose selection is the stay as it stands. */
    comboInUse: string;
    buildTitle: string;
    buildLead: string;
    room: string;
    food: string;
    addons: string;
    /** Why a ticked add-on cannot be unticked. */
    alwaysIncluded: string;
    medicationIncluded: string;
    totalLabel: string;
    includesGst: (gst: string) => string;
    perNight: string;
    forPet: (index: number) => string;
    showBreakdown: string;
    hideBreakdown: string;
    validUntil: (time: string) => string;
    repricing: string;
    repriceFailed: string;
    /** The last change could not be priced for a reason other than the combination itself. */
    priceFailed: string;
    changedWhileAgreeing: string;
    /** Catalogue price units, translated; an unknown unit is shown as nothing, not raw English. */
    units: Record<string, string>;
    priceChanged: (name: string, before: string, after: string) => string;
    promises: string[];
    nextStepsTitle: string;
    nextSteps: string[];
    sampleToggle: string;
    sampleTitle: string;
    sampleLabel: string;
    sampleEntries: Array<{ time: string; text: string }>;
    sampleCaption: string;
    /** Under the options: choosing one sends nothing, the terms are agreed on the next screen. */
    requestNotice: string;
    chooseButton: string;
    /** The tag on the combo the assistant recommends. */
    recommended: string;
    fullyBookedTitle: string;
    /** `nights` is already a readable list, e.g. "13 Oct and 14 Oct". */
    fullyBooked: (nights: string) => string;
    agreeing: string;
    /** Continue was pressed with no priced stay to continue with. */
    choosePrompt: string;
    holdRenewed: string;
  };
  handoff: {
    title: string;
    lead: string;
    emailPlan: string;
    /** For a signed-in parent: the plan goes to our team in their chat. */
    sendInChat: string;
    sendingInChat: string;
    copyPlan: string;
    copied: string;
    call: (phone: string) => string;
    emailUs: (email: string) => string;
    signInInstead: string;
    noContact: string;
    close: string;
    planSubject: string;
    planHeading: string;
    planLines: {
      dates: string;
      pets: string;
      option: string;
      total: string;
      extras: string;
    };
  };
  /**
   * The sign-in step after "Continue with this stay" and the sign-in dialog. The store still calls
   * the step `verify`, so saved plans and ?step=verify addresses keep working.
   */
  verify: {
    title: string;
    lead: string;
    emailLabel: string;
    passwordLabel: string;
    signIn: string;
    signingIn: string;
    forgotPassword: string;
    createAccount: string;
    /** On the details step, when the session lapsed before the request was sent. */
    signInAgain: string;
    signInTitle: string;
    signInLead: string;
    signedIn: string;
    close: string;
    /**
     * The form checks the first two itself: the browser would word them in its own language. The
     * rest are the server's answers in the page's words (English shows the server's own sentence
     * for a refusal, the way the sign-in page does).
     */
    errors: {
      emailInvalid: string;
      passwordRequired: string;
      unknownEmail: string;
      wrongPassword: string;
      staffAccount: string;
      connection: string;
    };
  };
  details: {
    title: string;
    lead: string;
    you: string;
    /** A first-time guest's account, made with the booking: no separate sign-up. */
    account: {
      title: string;
      lead: string;
      email: string;
      password: string;
      passwordHint: string;
      haveAccount: string;
      signIn: string;
    };
    firstName: string;
    lastName: string;
    address: string;
    addressHint: string;
    phone: string;
    phoneHint: string;
    emergencyContactNumber: string;
    emergencyContactHint: string;
    petsTitle: string;
    petName: string;
    breed: string;
    useSaved: string;
    newPet: string;
    times: string;
    dropOff: string;
    pickUp: string;
    notes: string;
    notesHint: string;
    notesFromChat: string;
    /** Shown read-only on a pet linked to one of the account's saved pets. */
    savedPetNote: string;
    termsTitle: string;
    requestNotice: string;
    termsSummary: string[];
    /** Every clause, fetched on first open. The text itself is in English only. */
    fullTerms: {
      show: string;
      loading: string;
      failed: string;
      retry: string;
      /** Null when the page is already in the terms' language. */
      languageNote: string | null;
      /** Over a translation: the English version is the one agreed to. Null in English. */
      translationNote: string | null;
      showOriginal: string;
    };
    /**
     * The booking terms: one box, never ticked for the parent. Emergency vet consent has its own box, clearer evidence of that consent.
     */
    agreeCheckbox: string;
    vetConsentCheckbox: string;
    /**
     * The stays our manager checks before confirming them (a pet on medication): a line on each
     * pet that will be checked, so the guest knows before sending.
     */
    review: {
      /** `reasons` is already joined, e.g. "takes medication". */
      notice: (reasons: string) => string;
      reasons: Record<ManagerReviewReason, string>;
    };
    /** Nothing is paid online: shown above the send button. */
    payAtDesk: string;
    summaryTitle: string;
    change: string;
    submit: string;
    submitting: string;
    back: string;
    fixTitle: (count: number) => string;
    errors: Record<DetailsField, string>;
    namesFirst: 'given' | 'family';
  };
  /**
   * The Sent screen. It shows a plain receipt with each pet's status. The boarding pass itself is in
   * My stays, for the stays that are confirmed.
   */
  done: {
    titles: Record<ConciergeCheckoutStatus, string>;
    leads: Record<ConciergeCheckoutStatus, string>;
    receiptTitle: string;
    reference: string;
    copyReference: string;
    referenceCopied: string;
    status: string;
    waitingForReview: string;
    confirmed: string;
    dropOff: string;
    pickUp: string;
    /** The receipt's total, paid at the desk on arrival. */
    totalToPay: string;
    /** Shown only when a stay waits for our manager. */
    waitingNotBooked: string;
    /** Nothing was paid: our manager decides by `deadline` (formatted, e.g. "Fri 2 Oct 3:00 pm"). */
    payAtDesk: (amount: string, deadline: string) => string;
    accountCreated: (email: string) => string;
    whatNextTitle: string;
    whatNext: string[];
    tasksTitle: string;
    tasksLead: string;
    tasks: Record<ConciergeSafetyTask, { title: string; detail: string }>;
    doItNow: string;
    teamCollects: string;
    forPet: (index: number) => string;
    addToCalendar: string;
    /** Only a confirmed booking is a plain stay; anything waiting says it is not confirmed yet. */
    calendarTitles: Record<ConciergeCheckoutStatus, string>;
    /** Shown by the calendar reminder the day before drop-off. */
    calendarDropOffReminder: string;
    print: string;
    planAnother: string;
    comeBackBySigningIn: string;
    myStays: string;
  };
  errors: {
    generic: string;
    network: string;
    rateLimited: string;
    notConfigured: string;
    catalogueIncomplete: string;
    emailNotConfigured: string;
    codeInvalid: string;
    codeCooldown: (seconds: number) => string;
    codeTooMany: string;
    codeLocked: string;
    staffEmail: string;
    emailTaken: string;
    alreadySubmitted: (reference: string) => string;
    inProgress: string;
    quoteStale: string;
    quoteExpired: string;
    /** A hand-built combination the server refused; the last priced stay is kept. */
    selectionInvalid: string;
    fullyBooked: string;
    petCountMismatch: string;
    petNotOwned: string;
    petDuplicated: string;
    contactRequired: string;
    emailUnverified: string;
    passwordAccount: string;
    /** A first-time guest's email already has an account. */
    accountExists: string;
    /** A first-time guest's password does not meet the sign-up rule. */
    passwordInvalid: string;
    /** The session lapsed while the details were open; the request waits for a new sign-in. */
    signInAgain: string;
    petSpeciesMismatch: string;
    validation: string;
    /** The terms changed after the page loaded them; agreeing again means reading the new ones. */
    termsChanged: string;
    termsUnavailable: string;
    /** The agreement is signed with the account's name, and this account has none. */
    nameMissing: string;
  };
}

const EN: ConciergeCopy = {
  pageTitle: 'Plan your pet’s stay',
  pageLead:
    'Tell our booking assistant what you need. You can type, speak or tap an answer. You’ll see suggested stays with the full price, and you can change any line, before you commit to anything.',
  listJoiner: ', ',
  aiBadge: 'AI booking assistant',
  talkToPerson: 'Talk to a person',
  helpNav: 'Booking help',
  signIn: 'Sign in',
  returningSignIn: 'Booked with us before? Sign in',
  myPetCentre: 'My pet centre',
  documentTitle: {
    plan: 'Plan your pet’s stay · Wagstay',
    verify: 'Sign in to continue · Wagstay',
    details: 'A few details · Wagstay',
    done: 'Request sent · Wagstay',
  },
  steps: {
    plan: 'Tell us',
    choose: 'Choose',
    verify: 'Sign in',
    details: 'Details',
    done: 'Requested',
  },
  a11y: { you: 'You: ', assistant: 'Assistant: ', done: '(done)', selected: '(selected)' },
  rates: {
    fromLine: (amount) =>
      `A night for one pet from ${amount}. Room, food and GST are included. No booking or card fees.`,
    showAll: 'See all rates',
    hideAll: 'Hide rates',
    rooms: 'Rooms',
    food: 'Food',
    extras: 'Extras',
  },
  bookingOffNotice:
    'You can plan and see prices here, but online booking is paused right now. Send your plan to our team in one tap and we will book it for you.',
  chat: {
    title: 'Booking assistant',
    greeting: (mode) =>
      mode === 'model'
        ? 'Hi! I’m the Wagstay booking assistant. I’m an AI, not a person, and I can get things wrong, so please check the options and prices on the cards before you book. Tell me about your pet and when you need a stay, or tap an answer below.'
        : mode === 'rules'
          ? 'Hi! I’m the Wagstay booking assistant, an automated helper, not a person. I understand simple phrases only, and the answer buttons always work. Tell me about your pet and when you need a stay, or tap an answer below, and I’ll put together options with the full price.'
          : 'Hi! I’m the Wagstay booking assistant, an automated helper, not a person. Tell me about your pet and when you need a stay, or tap an answer below, and I’ll put together options with the full price.',
    placeholder: 'For example: two dogs, 12 to 15 October, one needs medication…',
    send: 'Send',
    sending: 'Sending…',
    thinking: 'The assistant is thinking',
    rulesMode:
      'The assistant is in basic mode and understands only simple phrases. The answer buttons and the choices under Your stay always work.',
    assistantDown:
      'The assistant can’t reply right now. The answer buttons and the choices under Your stay still update your options.',
    enterHint: 'Enter to send · Shift + Enter for a new line',
    listening: 'Listening… press the button again when you finish.',
    voiceNotice: (speech) => describeVoiceProcessing(AI_PROCESSING_COPY.en, speech),
    dictation: {
      start: 'Speak instead of typing',
      stop: 'Stop and add what I said',
      requesting: 'Waiting for microphone permission',
      finishing: 'Adding your words',
    },
    dictationErrors: {
      unsupported: 'This browser can’t take voice input. Please type instead.',
      permissionDenied:
        'Microphone access is blocked. You can allow it in your browser’s site settings, or type instead.',
      noMicrophone: 'No microphone was found. Please type instead.',
      failed: 'Voice input stopped working. Please type instead, or try again.',
    },
    retry: 'Try again',
    restored: 'Welcome back. We kept your plan in this tab.',
    startOver: 'Start over',
    startOverConfirm: 'Clear this plan and start again?',
    startOverYes: 'Yes, start over',
    startOverNo: 'Keep my plan',
    stuck: 'Would tapping answers be easier?',
    openChecklist: 'Tick boxes instead',
  },
  answers: {
    groupLabel: 'Quick answers',
    starterDog: 'A stay for my dog',
    starterCat: 'A stay for my cat',
    starterSeveral: 'More than one pet',
    boardingYes: 'Yes, plan a boarding stay',
    petCount: (count, species) =>
      `${count} ${species === 'dog' ? (count === 1 ? 'dog' : 'dogs') : count === 1 ? 'cat' : 'cats'}`,
    dogAndCat: 'A dog and a cat',
    somethingElse: 'Something else',
    speciesFor: (index) => `Pet ${index + 1} is a…`,
    sizeFor: (index) => `Pet ${index + 1} size`,
    chooseDates: 'Choose dates',
    useDates: 'Use these dates',
    datesPreview: (range, nights) => `${range} · ${nights}`,
    medicationQuestion: 'Does anyone take medication?',
    medicationQuestionOthers: 'Does anyone else take medication?',
    noMedication: 'No medication',
    noOtherMedication: 'No one else',
    petTakesMedication: (index) => `Pet ${index + 1} does`,
    allTakeMedication: 'All of them',
    othersTakeMedication: 'All the others',
    seeOptions: 'Open my stay',
    bookForMe: 'Book the recommended stay for me',
    sameAsLastTime: 'Same as last time',
    savedPetsTitle: 'Who’s staying?',
    chipMessage: {
      dogs: (count) => `${count} ${count === 1 ? 'dog' : 'dogs'}`,
      cats: (count) => `${count} ${count === 1 ? 'cat' : 'cats'}`,
      dogAndCat: 'A dog and a cat',
      species: (index, species) => `Pet ${index + 1} is a ${species.toLowerCase()}`,
      size: (index, size) => `Pet ${index + 1} is ${size.toLowerCase()}`,
      dates: (range) => range,
      noMedication: 'No medication',
      noOtherMedication: 'No one else takes medication',
      medication: (index) => `Pet ${index + 1} takes medication`,
      allMedication: 'They all take medication',
      othersMedication: 'The others all take medication',
      savedPet: (name) => `${name} is coming`,
    },
  },
  privacy: {
    summary:
      'We use what you tell us here only to plan and price your stay. Conversations that don’t become a request are not saved.',
    detailsToggle: 'How we handle your information',
    details: (aiProcessing) => [
      'We collect your pet’s details, your dates and, when you send a request, your contact details. We use them only to arrange and run the stay.',
      describeAiProcessing(AI_PROCESSING_COPY.en, aiProcessing),
      'Chats that don’t turn into a request are not stored on our servers. When you send a request, we keep your details and the stay you agreed to.',
      'Your progress is kept only in this browser tab, so a reload doesn’t lose it. Pressing “Start over” or closing the tab clears it. After you send the request, only what the request receipt shows stays in the tab: no chat, names or contact details.',
      'You can ask to see or correct your information at any time by contacting our team.',
    ],
  },
  stay: {
    dates: 'Dates',
    nights: (count) => `${count} night${count === 1 ? '' : 's'}`,
    pets: (count) => `${count} pet${count === 1 ? '' : 's'}`,
    guests: 'Guests',
    chosen: 'Stay',
    extras: 'Extras',
    none: 'None',
    ready: 'Ready to quote',
    stillNeeded: 'Still needed',
    medication: 'medication',
    firstStay: 'first stay',
    notes: 'Notes for our team',
    sizeHint: 'Dog size helps our team choose the room. You can still see your options without it.',
    dateProblem: {
      end_before_start: 'Check-out must be at least one day after check-in.',
      in_past: 'That check-in date has already passed.',
      too_long: 'You can book up to 60 nights online. For a longer stay, please talk to our team.',
    },
  },
  checklist: {
    title: 'Your stay',
    hint: 'Prefer ticking boxes? Every change here updates your options straight away.',
    startDate: 'Check-in date',
    endDate: 'Check-out date',
    petCount: 'How many pets',
    petLabel: (index) => `Pet ${index + 1}`,
    species: 'Type',
    dog: 'Dog',
    cat: 'Cat',
    other: 'Other',
    size: 'Size',
    small: 'Small',
    medium: 'Medium',
    large: 'Large',
    medication: 'Needs medication',
    firstStay: 'First stay with us',
    toggleOpen: 'Edit your stay',
    toggleClose: 'Hide',
  },
  extras: {
    walks: 'Daily walks',
    grooming: 'Grooming or a bath',
    playtime: 'Group playtime',
  },
  missing: {
    service: 'the service',
    dates: 'dates',
    pets: 'number of pets',
    species: 'dog or cat',
    size: 'dog size',
  },
  packages: {
    title: 'Your stay',
    lead: 'Our booking system works out every price from our published rates. The assistant doesn’t set them.',
    close: 'Close',
    openChip: 'Open your stay',
    suggestedTitle: 'Suggested stays',
    useCombo: 'Use this combo',
    comboInUse: 'In use',
    buildTitle: 'Build your own stay',
    buildLead: 'Change any line. The price updates straight away.',
    room: 'Room',
    food: 'Food',
    addons: 'Add-ons',
    alwaysIncluded: 'Always included',
    medicationIncluded: 'Included because this pet takes medication',
    totalLabel: 'Total',
    includesGst: (gst) => `includes GST of ${gst}`,
    perNight: 'per night',
    forPet: (index) => `Pet ${index + 1}`,
    showBreakdown: 'See the full breakdown',
    hideBreakdown: 'Hide the breakdown',
    validUntil: (time) => `Price held until ${time}`,
    repricing: 'Updating price…',
    repriceFailed: 'We couldn’t update the prices for your latest change.',
    priceFailed: 'We couldn’t price your latest change.',
    changedWhileAgreeing:
      'Your plan changed while we were saving your choice. Please check the updated price and choose again.',
    units: {
      'per night': 'per night',
      'per day': 'per day',
      'per stay': 'per stay',
      'per session': 'per session',
      'per check': 'per check',
      'per walk': 'per walk',
    },
    priceChanged: (name, before, after) => `${name} is now ${after} (it was ${before}).`,
    promises: [
      'The price shown is the final price, GST included',
      'No booking fees',
      'Nothing is paid online: you pay at the desk on arrival',
      'Our manager approves each request',
    ],
    nextStepsTitle: 'What happens next',
    nextSteps: [
      'You send your request. Nothing is booked or paid yet.',
      'Our manager checks it and approves or declines it. You hear the answer in your notifications and in the chat.',
      'Before check-in, add vaccination proof. You give emergency vet consent, up to NZ$500, with its own tick when you send the booking.',
    ],
    sampleToggle: 'See an example daily update',
    sampleTitle: 'What you’ll see during the stay',
    sampleLabel: 'Example',
    sampleEntries: [
      { time: '8:05 am', text: 'Breakfast finished' },
      { time: '10:30 am', text: 'Toilet break in the yard' },
      { time: '1:15 pm', text: 'Play time, with a photo when staff add one' },
      { time: '5:30 pm', text: 'Dinner finished' },
    ],
    sampleCaption:
      'An example, not a real pet. Real entries appear in your account when our staff record care. They are private to you.',
    requestNotice:
      'Continuing sends nothing yet. On the next screen you check the details, agree to the booking terms and send the request.',
    chooseButton: 'Continue with this stay',
    recommended: 'Recommended for you',
    fullyBookedTitle: 'Those dates are full',
    fullyBooked: (nights) =>
      `We have no room left on ${nights}. Change the dates in the checklist, or tell the assistant other dates.`,
    agreeing: 'Saving your choice…',
    choosePrompt: 'Pick a suggested stay, or build one, to continue.',
    holdRenewed: 'Your price hold was renewed at the same price.',
  },
  handoff: {
    title: 'Send this plan to our team',
    lead: 'Our team can finish this booking with you. Send them your plan or give them a call. We don’t store anything until you send it.',
    emailPlan: 'Email this plan to our team',
    sendInChat: 'Send it to our team in chat',
    sendingInChat: 'Opening the chat…',
    copyPlan: 'Copy my plan',
    copied: 'Copied',
    call: (phone) => `Call us on ${phone}`,
    emailUs: (email) => `Or email ${email}`,
    signInInstead: 'Already a customer? Sign in to finish online',
    noContact:
      'Our contact details aren’t available on this page right now. Copy your plan so it’s ready when you reach us.',
    close: 'Close',
    planSubject: 'Booking request from the website',
    planHeading: 'My plan',
    planLines: {
      dates: 'Dates',
      pets: 'Pets',
      option: 'Stay',
      total: 'Total (GST incl.)',
      extras: 'Extras',
    },
  },
  verify: {
    title: 'Sign in to continue',
    lead: 'Your stay is kept. Signing in lets us remember your pets for next time. New here? Create an account below.',
    emailLabel: 'Email address',
    passwordLabel: 'Password',
    signIn: 'Sign in',
    signingIn: 'Signing in…',
    forgotPassword: 'Forgot password?',
    createAccount: 'Create an account',
    signInAgain: 'Sign in again',
    signInTitle: 'Booked with us before? Sign in',
    signInLead: 'Sign in with your email and password. Your plan stays as it is.',
    signedIn: 'You’re signed in. Your saved pets are ready to use.',
    close: 'Close',
    errors: {
      emailInvalid: 'Enter your email address, like name@example.com.',
      passwordRequired: 'Enter your password.',
      unknownEmail: 'No account with this email yet. Create one below.',
      wrongPassword: 'Wrong password. Try again.',
      staffAccount: 'This is a staff account. Please sign in with a pet parent account to book.',
      connection: 'We couldn’t reach the sign-in service. Please try again.',
    },
  },
  details: {
    title: 'A few details',
    lead: 'This is everything we need to send your request.',
    you: 'About you',
    account: {
      title: 'Your Wagstay account',
      lead: 'First time here? No sign-up needed. We make your account and your pet’s profile when you send this booking.',
      email: 'Email',
      password: 'Choose a password',
      passwordHint: 'You sign in with it next time.',
      haveAccount: 'Already have an account?',
      signIn: 'Sign in',
    },
    firstName: 'First name',
    lastName: 'Last name',
    address: 'Home address (optional)',
    addressHint: 'Only if you would like it kept on your account.',
    phone: 'Your mobile',
    emergencyContactNumber: 'Emergency contact number (optional)',
    emergencyContactHint:
      'You can leave this blank. If you add someone, please tell them Wagstay keeps their number to contact them about your pet in an emergency. They can ask our team to access or correct it.',
    phoneHint: 'We use it only to contact you about this request. For example 021 123 4567.',
    petsTitle: 'Your pets',
    petName: 'Name',
    breed: 'Breed (optional)',
    useSaved: 'Choose a saved pet',
    newPet: 'A new pet',
    times: 'Check-in and check-out times',
    dropOff: 'Check-in time',
    pickUp: 'Check-out time',
    notes: 'Anything our team should know? (optional)',
    notesHint: 'Routines, favourite toys, medication and dose, health notes for staff.',
    notesFromChat: 'We added what you told the assistant. Change it if you like.',
    savedPetNote: 'One of your saved pets',
    termsTitle: 'Booking terms',
    requestNotice:
      'When you send this, our manager checks each pet’s stay and approves or declines it. Nothing is booked or paid until then.',
    termsSummary: [
      'You can cancel or change your dates yourself in My Stays. For an emergency or a sick pet, contact our team.',
      'By check-in we need vaccination proof that shows the date given and the next due date, and your consent to emergency vet care up to NZ$500 if we cannot reach you, given with its own tick below. These are Wagstay’s requirements. The vaccines we ask for (C5 for dogs, F3 for cats) are our own rule, not a law.',
      'A pet without vaccination proof still stays with us, kept apart from other pets until its vaccination status is known, at no extra cost.',
      'Your consumer guarantee rights are not affected.',
    ],
    fullTerms: {
      show: 'Read the full booking terms',
      loading: 'Loading the terms…',
      failed: 'We couldn’t load the terms.',
      retry: 'Try again',
      languageNote: null,
      translationNote: null,
      showOriginal: 'Show the English original',
    },
    agreeCheckbox: 'I agree to the booking terms',
    vetConsentCheckbox:
      'If you can’t reach me, Wagstay may arrange emergency vet treatment for my pet, up to NZ$500',
    review: {
      notice: (reasons) =>
        `Our manager checks this stay before confirming it (${reasons}). The answer appears in My stays.`,
      reasons: {
        medication: 'takes medication',
      },
    },
    payAtDesk:
      'Nothing is paid online. Our manager approves or declines your request, and you pay at the desk on arrival, after a quick health check.',
    summaryTitle: 'Your request',
    change: 'Change',
    submit: 'Send booking request',
    submitting: 'Sending your request…',
    back: 'Change dates or stay',
    fixTitle: (count) =>
      count === 1 ? 'One thing to fix before sending:' : `${count} things to fix before sending:`,
    errors: {
      firstName: 'Add your first name.',
      lastName: 'Add your last name.',
      address: 'Add your full home address, or leave it empty.',
      emergencyContactNumber: 'Enter a valid emergency number or leave it blank.',
      phone: 'Add a mobile number we can reach you on, for example 021 123 4567.',
      email: 'Add a valid email address.',
      password: 'Choose a password that meets every rule below.',
      accountExists: 'This email already has an account. Sign in to book with it.',
      petName: 'Add a name for each pet, or choose a saved pet.',
      dropOffTime: 'Choose a check-in time.',
      pickUpTime: 'Choose a check-out time.',
      termsAccepted: 'Tick the box to agree to the booking terms.',
      vetConsent: 'Tick the box to give emergency vet consent.',
      nameTooLong: 'Names can be up to 100 characters.',
      addressTooLong: 'Please shorten the address to 300 characters.',
      phoneTooLong: 'Phone numbers can be up to 20 characters.',
      breedTooLong: 'Please shorten the breed to 100 characters.',
    },
    namesFirst: 'given',
  },
  done: {
    titles: {
      confirmed: 'Booking confirmed',
      partly_confirmed: 'Booking sent',
      awaiting_manager_approval: 'Request sent',
    },
    leads: {
      confirmed:
        'Thank you! Your stay is confirmed. Keep this reference. Your boarding pass is in My stays.',
      partly_confirmed:
        'Thank you! Some stays are confirmed, and our manager checks the others first. Keep this reference. The latest status is always in My stays.',
      awaiting_manager_approval:
        'Thank you! Our manager checks your request before confirming it. Keep this reference. The latest status is always in My stays.',
    },
    receiptTitle: 'Request receipt',
    reference: 'Reference',
    copyReference: 'Copy reference',
    referenceCopied: 'Reference copied',
    status: 'Status',
    waitingForReview: 'Waiting for review',
    confirmed: 'Confirmed',
    dropOff: 'Check-in',
    pickUp: 'Check-out',
    totalToPay: 'Total, paid at the desk',
    waitingNotBooked:
      'A stay waiting for review is not booked yet. We will tell you here, in your notifications and in the chat, once our manager decides.',
    payAtDesk: (amount, deadline) =>
      `Please wait a moment: our manager will approve or decline your request by ${deadline}. Nothing has been paid. If it is approved, you pay ${amount} at the desk on arrival, after a quick health check.`,
    accountCreated: (email) => `We’ve created your account for ${email}.`,
    whatNextTitle: 'What happens next',
    whatNext: [
      'Our manager checks each stay marked Waiting for review. The answer appears in your notifications, in the chat and in My stays.',
      'Once a stay is approved, its boarding pass is in My stays. On the day, we do a quick health check at the desk and you pay there.',
    ],
    tasksTitle: 'Before check-in',
    tasksLead: 'We need these by check-in. They are Wagstay’s requirements.',
    tasks: {
      vaccination_certificate: {
        title: 'Vaccination proof',
        detail:
          'Add a certificate that shows the date given and the next due date. Without proof, your pet is kept apart from other pets until its vaccination status is known.',
      },
      emergency_vet_consent: {
        title: 'Emergency vet consent',
        detail:
          'For an older booking, our team checks the consent on file. New bookings give it with its own tick.',
      },
    },
    doItNow: 'Do it now',
    teamCollects: 'Our team will go through this with you by check-in.',
    forPet: (index) => `Pet ${index + 1}`,
    addToCalendar: 'Add to my calendar',
    calendarTitles: {
      confirmed: 'Wagstay stay',
      partly_confirmed: 'Wagstay stay (some pets not yet confirmed)',
      awaiting_manager_approval: 'Wagstay request (not yet confirmed)',
    },
    calendarDropOffReminder: 'Bring the vaccination certificate.',
    print: 'Print or save this page',
    planAnother: 'Plan another stay',
    comeBackBySigningIn:
      'Coming back later? Open this page and choose “Booked with us before? Sign in”, then sign in with your email and password.',
    myStays: 'See my stays',
  },
  errors: {
    generic: 'Something went wrong. Please try again.',
    // Also shown when the server is down, so it does not blame the guest's connection.
    network:
      'Our booking system isn’t answering right now. Try again in a moment, or talk to a person.',
    rateLimited: 'That’s a lot of requests in a short time. Please wait a minute and try again.',
    notConfigured: 'Online booking isn’t available right now. Please talk to our team.',
    catalogueIncomplete: 'Online prices aren’t available right now. Please talk to our team.',
    emailNotConfigured:
      'We can’t send email codes online yet. Sign in if you already have an account, or send your plan to our team.',
    codeInvalid:
      'That code doesn’t match or has expired. Check the newest email from us, or send a new code.',
    codeCooldown: (seconds) => `Please wait ${seconds} seconds before asking for another code.`,
    codeTooMany: 'Too many codes were requested for this email. Please try again in an hour.',
    codeLocked:
      'Too many wrong codes for this email. Please try again tomorrow or talk to our team.',
    staffEmail: 'This email belongs to a staff account. Please use a personal email to book.',
    emailTaken: 'An account was just created for this email. Please confirm your email again.',
    alreadySubmitted: (reference) =>
      `This request was already sent (reference ${reference}). You don’t need to send it again.`,
    inProgress: 'Your request is already being sent. Please wait a moment.',
    quoteStale: 'Something in this option is no longer offered. Please choose again.',
    quoteExpired: 'This price has expired. We’re fetching a fresh one.',
    selectionInvalid: 'That combination can’t be booked, so we kept your last priced stay.',
    fullyBooked: 'Sorry, some of those nights just filled up. Please choose other dates.',
    petCountMismatch: 'This option is for a different number of pets. Please check your pets.',
    petNotOwned: 'One of the saved pets isn’t on your account. Please choose again.',
    petDuplicated: 'Each saved pet can only be chosen once.',
    contactRequired: 'Please add your contact details so we can create your account.',
    emailUnverified: 'Please confirm your email before sending.',
    accountExists: 'This email already has an account. Sign in to book with it; your plan is kept.',
    passwordInvalid: 'Choose a password that meets every rule shown under it.',
    passwordAccount:
      'This email already has an account with a password. Please sign in with your password to book. We’ll keep your plan.',
    signInAgain:
      'Your sign-in has expired. Sign in again to send your request. Everything you typed is kept.',
    petSpeciesMismatch:
      'A saved pet isn’t the kind of pet in this plan. Choose another pet, or change the plan.',
    validation: 'Some details need another look.',
    termsChanged:
      'The booking terms have changed. Refresh the page, read them and agree again. Your plan is kept.',
    termsUnavailable: 'The booking terms can’t be loaded right now. Please try again shortly.',
    nameMissing: 'Please add your name to your profile, then send the request again.',
  },
};

const ZH: ConciergeCopy = {
  pageTitle: '为毛孩子安排一次住宿',
  pageLead:
    '把你的需求告诉预约助手就行。你可以打字、说话，或者直接点选答案。确定之前，你会先看到推荐方案和完整价格，每一项都可以自己调整。',
  listJoiner: '、',
  aiBadge: 'AI 预约助手',
  talkToPerson: '联系工作人员',
  helpNav: '预约帮助',
  signIn: '登录',
  returningSignIn: '以前预约过？登录',
  myPetCentre: '我的宠物中心',
  documentTitle: {
    plan: '安排住宿 · Wagstay',
    verify: '登录后继续 · Wagstay',
    details: '填写信息 · Wagstay',
    done: '申请已提交 · Wagstay',
  },
  steps: { plan: '说需求', choose: '选住宿', verify: '登录', details: '填信息', done: '已提交' },
  a11y: { you: '你：', assistant: '助手：', done: '（已完成）', selected: '（已选择）' },
  rates: {
    fromLine: (amount) => `一只宠物住一晚 ${amount} 起，含房间、餐食和 GST，没有预订费或刷卡费。`,
    showAll: '查看全部价格',
    hideAll: '收起价格',
    rooms: '房间',
    food: '餐食',
    extras: '附加服务',
  },
  bookingOffNotice:
    '你可以在这里规划并查看价格，但目前暂停在线预订。一键把方案发给我们的工作人员，我们会为你完成预订。',
  chat: {
    title: '预约助手',
    greeting: (mode) =>
      mode === 'model'
        ? '你好！我是 Wagstay 的预约助手，是 AI，不是真人，也可能出错，请在预约前核对卡片上的方案和价格。告诉我宠物的情况和需要寄养的日期，或者直接点下面的选项。'
        : mode === 'rules'
          ? '你好！我是 Wagstay 的预约助手，是自动程序，不是真人。我只能理解简单的说法，点选按钮始终可用。告诉我宠物的情况和需要寄养的日期，或者直接点下面的选项，我会为你整理出带完整价格的方案。'
          : '你好！我是 Wagstay 的预约助手，是自动程序，不是真人。告诉我宠物的情况和需要寄养的日期，或者直接点下面的选项，我会为你整理出带完整价格的方案。',
    placeholder: '比如：两只狗，10月12日至15日，其中一只要吃药…',
    send: '发送',
    sending: '发送中…',
    thinking: '助手正在思考',
    rulesMode: '助手现在是基础模式，只能理解简单的说法。点选按钮和“你的住宿”里的选项始终可用。',
    assistantDown: '助手暂时无法回复，点选按钮和“你的住宿”里的选项仍然会更新你的方案。',
    enterHint: '回车发送 · Shift + 回车换行',
    listening: '正在听…说完再点一下按钮。',
    voiceNotice: (speech) => describeVoiceProcessing(AI_PROCESSING_COPY.zh, speech),
    dictation: {
      start: '用说话代替打字',
      stop: '停止并加入我说的话',
      requesting: '等待麦克风权限',
      finishing: '正在加入文字',
    },
    dictationErrors: {
      unsupported: '这个浏览器不支持语音输入，请改用打字。',
      permissionDenied: '麦克风权限被关闭了。可以在浏览器的网站设置里打开，或者改用打字。',
      noMicrophone: '没有找到麦克风，请改用打字。',
      failed: '语音输入中断了，请改用打字，或再试一次。',
    },
    retry: '重试',
    restored: '欢迎回来，你在这个标签页里的方案都还在。',
    startOver: '重新开始',
    startOverConfirm: '清空这个方案，重新开始？',
    startOverYes: '是的，重新开始',
    startOverNo: '保留方案',
    stuck: '直接点选答案会不会更方便？',
    openChecklist: '改用勾选',
  },
  answers: {
    groupLabel: '快速回答',
    starterDog: '给狗狗安排住宿',
    starterCat: '给猫咪安排住宿',
    starterSeveral: '不止一只宠物',
    boardingYes: '好的，安排寄养',
    petCount: (count, species) => `${count} 只${species === 'dog' ? '狗' : '猫'}`,
    dogAndCat: '一只狗和一只猫',
    somethingElse: '其他情况',
    speciesFor: (index) => `宠物 ${index + 1} 是…`,
    sizeFor: (index) => `宠物 ${index + 1} 的体型`,
    chooseDates: '选择日期',
    useDates: '使用这个日期',
    datesPreview: (range, nights) => `${range} · ${nights}`,
    medicationQuestion: '有宠物需要吃药吗？',
    medicationQuestionOthers: '还有别的宠物需要吃药吗？',
    noMedication: '都不用吃药',
    noOtherMedication: '其他都不用',
    petTakesMedication: (index) => `宠物 ${index + 1} 要吃`,
    allTakeMedication: '都要吃',
    othersTakeMedication: '其他都要吃',
    seeOptions: '打开我的住宿',
    bookForMe: '帮我订推荐的住宿',
    sameAsLastTime: '和上次一样',
    savedPetsTitle: '这次谁来住？',
    chipMessage: {
      dogs: (count) => `${count} 只狗`,
      cats: (count) => `${count} 只猫`,
      dogAndCat: '一只狗和一只猫',
      species: (index, species) => `宠物 ${index + 1} 是${species}`,
      size: (index, size) => `宠物 ${index + 1} 是${size}`,
      dates: (range) => range,
      noMedication: '都不用吃药',
      noOtherMedication: '其他宠物都不用吃药',
      medication: (index) => `宠物 ${index + 1} 要吃药`,
      allMedication: '都要吃药',
      othersMedication: '其他宠物都要吃药',
      savedPet: (name) => `${name} 来住`,
    },
  },
  privacy: {
    summary: '你在这里告诉我们的信息只用于安排寄养和计算价格。没有变成预约申请的对话不会保存。',
    detailsToggle: '我们如何处理你的信息',
    details: (aiProcessing) => [
      '我们会收集宠物情况、日期，以及提交申请时你的联系方式，只用于安排和照顾这次寄养。',
      describeAiProcessing(AI_PROCESSING_COPY.zh, aiProcessing),
      '没有变成预约申请的对话不会保存在我们的服务器上；提交申请后，我们会保存你的信息和你同意的住宿。',
      '你的进度只保存在这个浏览器标签页里，刷新也不会丢。点“重新开始”或关闭标签页，进度就会清除。提交申请后，标签页里只保留申请回执上的内容，不保留对话、名字或联系方式。',
      '你可以随时联系我们查看或更正你的信息。',
    ],
  },
  stay: {
    dates: '日期',
    nights: (count) => `${count} 晚`,
    pets: (count) => `${count} 只宠物`,
    guests: '住客',
    chosen: '住宿',
    extras: '附加服务',
    none: '无',
    ready: '可以报价了',
    stillNeeded: '还需要',
    medication: '吃药',
    firstStay: '第一次来住',
    notes: '给工作人员的备注',
    sizeHint: '狗狗体型能帮我们安排房间。不填也可以看到方案。',
    dateProblem: {
      end_before_start: '离店日期至少要比入住日期晚一天。',
      in_past: '入住的日期已经过了。',
      too_long: '线上最多可以预约 60 晚。住更久请联系我们的工作人员。',
    },
  },
  checklist: {
    title: '你的住宿',
    hint: '更喜欢打勾？这里的每一项改动都会立刻更新你的方案。',
    startDate: '入住日期',
    endDate: '离店日期',
    petCount: '宠物数量',
    petLabel: (index) => `宠物 ${index + 1}`,
    species: '种类',
    dog: '狗狗',
    cat: '猫咪',
    other: '其他',
    size: '体型',
    small: '小型',
    medium: '中型',
    large: '大型',
    medication: '需要吃药',
    firstStay: '第一次来住',
    toggleOpen: '修改住宿信息',
    toggleClose: '收起',
  },
  extras: {
    walks: '每天遛狗',
    grooming: '美容或洗澡',
    playtime: '集体玩耍',
  },
  missing: {
    service: '服务类型',
    dates: '日期',
    pets: '宠物数量',
    species: '狗还是猫',
    size: '狗狗体型',
  },
  packages: {
    title: '我的住宿',
    lead: '所有价格都由预约系统按公开价目计算，不是由助手定的。',
    close: '关闭',
    openChip: '打开我的住宿',
    suggestedTitle: '推荐方案',
    useCombo: '用这个方案',
    comboInUse: '正在使用',
    buildTitle: '自己搭配',
    buildLead: '每一项都可以改，价格会立刻更新。',
    room: '房间',
    food: '餐食',
    addons: '附加服务',
    alwaysIncluded: '必含项目',
    medicationIncluded: '这只宠物需要吃药，所以已经包含',
    totalLabel: '总价',
    includesGst: (gst) => `含 GST ${gst}`,
    perNight: '每晚',
    forPet: (index) => `宠物 ${index + 1}`,
    showBreakdown: '查看完整明细',
    hideBreakdown: '收起明细',
    validUntil: (time) => `价格保留到 ${time}`,
    repricing: '正在更新价格…',
    repriceFailed: '刚才的修改没能更新价格。',
    priceFailed: '刚才的改动没能算出价格。',
    changedWhileAgreeing: '保存你的选择时方案有了变化，请查看更新后的价格，再选一次。',
    units: {
      'per night': '每晚',
      'per day': '每天',
      'per stay': '每次寄养',
      'per session': '每次',
      'per check': '每次检查',
      'per walk': '每次遛狗',
    },
    priceChanged: (name, before, after) => `${name}现在是 ${after}（原来是 ${before}）。`,
    promises: [
      '显示的就是最终价格，含 GST',
      '没有预订费',
      '网上不付款：到店时在前台付款',
      '每个申请都由经理审核',
    ],
    nextStepsTitle: '接下来会怎样',
    nextSteps: [
      '你提交申请。这时还没有预订，也不用付款。',
      '经理审核后会批准或拒绝，结果会通过通知和聊天告诉你。',
      '入住前添加疫苗证明；提交预约时单独勾选，同意联系不上你时安排不超过 NZ$500 的紧急兽医治疗。',
    ],
    sampleToggle: '看看每日动态的示例',
    sampleTitle: '住宿期间你会看到什么',
    sampleLabel: '示例',
    sampleEntries: [
      { time: '上午 8:05', text: '早餐吃完了' },
      { time: '上午 10:30', text: '在院子里上厕所' },
      { time: '下午 1:15', text: '玩耍时间，工作人员添加照片后会显示' },
      { time: '下午 5:30', text: '晚餐吃完了' },
    ],
    sampleCaption:
      '这只是示例，不是真实的宠物。工作人员记录照顾情况后，真实动态会出现在你的账户里，只有你能看到。',
    requestNotice: '点继续还不会提交任何内容。下一步你核对信息、同意预约条款，然后提交申请。',
    chooseButton: '按这个住宿继续',
    recommended: '为你推荐',
    fullyBookedTitle: '这几天已经住满了',
    fullyBooked: (nights) => `${nights}已经没有空位了。请在清单里改日期，或告诉助手别的日期。`,
    agreeing: '正在保存…',
    choosePrompt: '请先选一个推荐方案，或者自己搭配一个。',
    holdRenewed: '价格保留已续期，价格不变。',
  },
  handoff: {
    title: '把方案发给工作人员',
    lead: '工作人员可以和你一起完成预约。把方案发给他们，或者直接打电话。在你发送之前，我们不会保存任何信息。',
    emailPlan: '用邮件把方案发给工作人员',
    sendInChat: '在聊天里发给工作人员',
    sendingInChat: '正在打开聊天…',
    copyPlan: '复制我的方案',
    copied: '已复制',
    call: (phone) => `打电话：${phone}`,
    emailUs: (email) => `或发邮件到 ${email}`,
    signInInstead: '已经是老顾客？登录后在线完成',
    noContact: '这个页面暂时无法显示联系方式。请先复制你的方案，联系我们时直接使用。',
    close: '关闭',
    planSubject: '网站预约申请',
    planHeading: '我的方案',
    planLines: {
      dates: '日期',
      pets: '宠物',
      option: '住宿',
      total: '总价（含 GST）',
      extras: '附加服务',
    },
  },
  verify: {
    title: '登录后继续',
    lead: '你的住宿方案已经保留。登录后，我们可以记住你的宠物，下次更方便。还没有账号？在下方创建一个。',
    emailLabel: '邮箱',
    passwordLabel: '密码',
    signIn: '登录',
    signingIn: '登录中…',
    forgotPassword: '忘记密码？',
    createAccount: '创建账号',
    signInAgain: '重新登录',
    signInTitle: '以前预约过？登录',
    signInLead: '用邮箱和密码登录，你的方案会原样保留。',
    signedIn: '已登录，可以直接选用已保存的宠物。',
    close: '关闭',
    errors: {
      emailInvalid: '请输入有效的邮箱地址。',
      passwordRequired: '请输入密码。',
      unknownEmail: '这个邮箱还没有账号，请在下方创建一个。',
      wrongPassword: '密码不对，请再试一次。',
      staffAccount: '这是员工账号，请用宠物家长账号登录后再预约。',
      connection: '连接登录服务失败，请重试。',
    },
  },
  details: {
    title: '再填几项信息',
    lead: '填完就能提交预约申请了。',
    you: '你的信息',
    account: {
      title: '你的 Wagstay 账号',
      lead: '第一次来？不用先注册。发送预订时，我们会直接帮你建好账号和宠物档案。',
      email: '邮箱',
      password: '设置密码',
      passwordHint: '下次用它登录。',
      haveAccount: '已经有账号？',
      signIn: '登录',
    },
    firstName: '名',
    lastName: '姓',
    address: '家庭住址（选填）',
    addressHint: '只有你希望保存在账户里时才需要填写。',
    phone: '你的手机号',
    emergencyContactNumber: '紧急联系人电话（选填）',
    emergencyContactHint:
      '可以留空。若填写，请告知对方 Wagstay 会保存此号码，仅在宠物遇到紧急情况时联系；对方可联系我们查看或更正资料。',
    phoneHint: '只用于就这份申请联系你，比如 021 123 4567。',
    petsTitle: '你的宠物',
    petName: '名字',
    breed: '品种（选填）',
    useSaved: '选择已保存的宠物',
    newPet: '新宠物',
    times: '入住和离店的时间',
    dropOff: '入住时间',
    pickUp: '离店时间',
    notes: '有什么需要我们知道的吗？（选填）',
    notesHint: '作息、喜欢的玩具、药物和剂量、需要员工注意的健康情况。',
    notesFromChat: '已经填入你告诉助手的内容，可以随意修改。',
    savedPetNote: '你保存的宠物',
    termsTitle: '预约条款',
    requestNotice: '提交后，经理会审核每只宠物的住宿，批准或拒绝。在那之前既没有预订，也不用付款。',
    termsSummary: [
      '你可以在“我的住宿”里自己取消或改期。遇到紧急情况或宠物生病，请联系我们的工作人员。',
      '入住之前，我们需要疫苗证明（上面要有接种日期和下次接种日期）；并请在下面单独勾选，授权我们在联系不上你时安排不超过 NZ$500 的紧急兽医治疗。这些是 Wagstay 自己的要求。我们要求的疫苗（狗狗 C5，猫咪 F3）是我们自己的规定，不是法律规定。',
      '没有疫苗证明的宠物照样可以入住，在确认疫苗情况之前会和其他宠物分开安置，不额外收费。',
      '你的法定消费者权益不受影响。',
    ],
    fullTerms: {
      show: '阅读完整预约条款',
      loading: '正在加载条款…',
      failed: '条款没有加载出来。',
      retry: '重试',
      languageNote: '这个版本的完整条款目前只有英文；上面的要点是中文摘要。',
      translationNote: '以下是中文译文，方便你阅读；如与英文版本有出入，以英文版本为准。',
      showOriginal: '查看英文原文',
    },
    agreeCheckbox: '我同意预约条款',
    vetConsentCheckbox: '联系不上我时，Wagstay 可以为我的宠物安排紧急兽医治疗，费用不超过 NZ$500',
    review: {
      notice: (reasons) =>
        `这只宠物的住宿要经理审核后才会确认（${reasons}）。审核结果会显示在“我的住宿”里。`,
      reasons: {
        medication: '需要用药',
      },
    },
    payAtDesk: '网上不付款。经理会批准或拒绝你的申请；到店时先做简单的健康检查，然后在前台付款。',
    summaryTitle: '你的申请',
    change: '修改',
    submit: '提交预约申请',
    submitting: '正在提交…',
    back: '修改日期或住宿',
    fixTitle: (count) => `提交前还有 ${count} 项需要处理：`,
    errors: {
      firstName: '请填写名。',
      lastName: '请填写姓。',
      address: '请填写完整的家庭住址，或者留空。',
      emergencyContactNumber: '请填写有效的紧急联系电话，或留空。',
      phone: '请填写能联系到你的手机号，比如 021 123 4567。',
      email: '请填写有效的邮箱地址。',
      password: '请设置符合下面每条规则的密码。',
      accountExists: '这个邮箱已经有账号了，请先登录再预订。',
      petName: '请为每只宠物填写名字，或选择已保存的宠物。',
      dropOffTime: '请选择入住时间。',
      pickUpTime: '请选择离店时间。',
      termsAccepted: '请勾选同意预约条款。',
      vetConsent: '请勾选同意紧急兽医治疗。',
      nameTooLong: '名字最多 100 个字符。',
      addressTooLong: '地址请控制在 300 个字符以内。',
      phoneTooLong: '电话号码最多 20 个字符。',
      breedTooLong: '品种请控制在 100 个字符以内。',
    },
    namesFirst: 'family',
  },
  done: {
    titles: {
      confirmed: '预约已确认',
      partly_confirmed: '预约已提交',
      awaiting_manager_approval: '申请已提交',
    },
    leads: {
      confirmed: '谢谢！你的住宿已经确认。请保留预约编号，住宿凭证在“我的住宿”里。',
      partly_confirmed:
        '谢谢！部分住宿已经确认，其余的要经理先审核。请保留预约编号，最新状态始终可以在“我的住宿”里查看。',
      awaiting_manager_approval:
        '谢谢！经理会先审核你的申请再确认。请保留预约编号，最新状态始终可以在“我的住宿”里查看。',
    },
    receiptTitle: '申请回执',
    reference: '预约编号',
    copyReference: '复制预约编号',
    referenceCopied: '预约编号已复制',
    status: '状态',
    waitingForReview: '等待审核',
    confirmed: '已确认',
    dropOff: '入住',
    pickUp: '离店',
    totalToPay: '总价（到店在前台支付）',
    waitingNotBooked: '等待审核的住宿还没有预约成功。经理决定后，我们会通过通知和聊天告诉你。',
    payAtDesk: (amount, deadline) =>
      `请稍等：经理会在 ${deadline} 之前批准或拒绝你的申请。现在还没有付任何费用。如果批准了，到店时先做简单的健康检查，然后在前台支付 ${amount}。`,
    accountCreated: (email) => `已为 ${email} 创建账号。`,
    whatNextTitle: '接下来会怎样',
    whatNext: [
      '标着“等待审核”的住宿由经理审核，结果会出现在通知、聊天和“我的住宿”里。',
      '住宿批准后，住宿凭证在“我的住宿”里。入住当天我们先在前台做简单的健康检查，然后你在前台付款。',
    ],
    tasksTitle: '入住之前',
    tasksLead: '最晚在入住时需要完成这几项。这些是 Wagstay 自己的要求。',
    tasks: {
      vaccination_certificate: {
        title: '疫苗证明',
        detail:
          '请添加疫苗证书，上面要有接种日期和下次接种日期。没有证明的话，在确认疫苗情况之前，宠物会和其他宠物分开安置。',
      },
      emergency_vet_consent: {
        title: '紧急就医同意书',
        detail: '旧版预约由工作人员检查就医同意记录；新预约在提交时已经单独勾选同意。',
      },
    },
    doItNow: '现在就去',
    teamCollects: '最晚在入住时，工作人员会和你一起完成这一项。',
    forPet: (index) => `宠物 ${index + 1}`,
    addToCalendar: '加入我的日历',
    calendarTitles: {
      confirmed: 'Wagstay 住宿',
      partly_confirmed: 'Wagstay 住宿（部分宠物尚未确认）',
      awaiting_manager_approval: 'Wagstay 住宿申请（尚未确认）',
    },
    calendarDropOffReminder: '带上疫苗证明。',
    print: '打印或保存这个页面',
    planAnother: '再安排一次住宿',
    comeBackBySigningIn: '之后想回来？打开这个页面，点“以前预约过？登录”，用邮箱和密码登录即可。',
    myStays: '查看我的住宿',
  },
  errors: {
    generic: '出了点问题，请重试。',
    network: '预约系统暂时没有响应，请稍后再试，或联系工作人员。',
    rateLimited: '短时间内的请求太多了，请等一分钟再试。',
    notConfigured: '在线预约暂时不可用，请联系我们的工作人员。',
    catalogueIncomplete: '在线价格暂时不可用，请联系我们的工作人员。',
    emailNotConfigured:
      '目前还不能在线发送邮箱验证码。如果你已有账号请登录，或者把方案发给我们的工作人员。',
    codeInvalid: '验证码不对或已过期。请查看我们最新发出的邮件，或重新发送验证码。',
    codeCooldown: (seconds) => `请等 ${seconds} 秒再重新发送验证码。`,
    codeTooMany: '这个邮箱申请验证码的次数太多了，请一小时后再试。',
    codeLocked: '这个邮箱输错验证码的次数太多了，请明天再试或联系工作人员。',
    staffEmail: '这个邮箱属于员工账号，请使用个人邮箱预约。',
    emailTaken: '这个邮箱刚刚创建了账号，请再验证一次邮箱。',
    alreadySubmitted: (reference) =>
      `这份申请已经提交过了（预约编号 ${reference}），不需要再提交。`,
    inProgress: '你的申请正在提交，请稍等。',
    quoteStale: '这个方案里有项目已经不再提供，请重新选择。',
    quoteExpired: '价格已过期，正在为你获取最新价格。',
    selectionInvalid: '这个组合无法预订，已为你保留上一次算好价格的住宿。',
    fullyBooked: '抱歉，其中有几晚刚刚住满了，请换个日期。',
    petCountMismatch: '这个方案的宠物数量不对，请检查你的宠物。',
    petNotOwned: '有一只已保存的宠物不在你的账户里，请重新选择。',
    petDuplicated: '每只已保存的宠物只能选一次。',
    contactRequired: '请填写联系信息，以便我们为你创建账号。',
    emailUnverified: '提交前请先验证邮箱。',
    accountExists: '这个邮箱已经有账号了。请先登录再预订，你的方案会保留。',
    passwordInvalid: '请设置符合下方每条规则的密码。',
    passwordAccount: '这个邮箱已经有设置了密码的账号。请用密码登录后再预约，你的方案会保留。',
    signInAgain: '登录已过期，请重新登录后再提交申请。你填写的内容都会保留。',
    petSpeciesMismatch: '所选的已保存宠物和方案里的宠物种类不同，请换一只宠物或修改方案。',
    validation: '有些信息需要再检查一下。',
    termsChanged: '预约条款已经更新。请刷新页面，阅读新条款后再同意，你的方案会保留。',
    termsUnavailable: '预约条款暂时无法加载，请稍后再试。',
    nameMissing: '请先在个人资料里填写你的姓名，再提交申请。',
  },
};

export const CONCIERGE_COPY: Record<ConciergeLocale, ConciergeCopy> = { en: EN, zh: ZH };

/** Labels for a species or size value, used by the chips, the stay card and the details step. */
export const speciesLabel = (copy: ConciergeCopy, species: ConciergeSpecies): string =>
  copy.checklist[species];

export const sizeLabel = (copy: ConciergeCopy, size: ConciergePetSize): string =>
  copy.checklist[size];
