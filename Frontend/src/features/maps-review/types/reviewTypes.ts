/** 1 to 5 star rating constraint for all review contexts. */
export type RatingStarCount = 1 | 2 | 3 | 4 | 5;

/** Aggregate rating distribution used by the mock review location header. */
export interface RatingBreakdown {
  stars: RatingStarCount;
  count: number;
}

/** Predefined topic chips for the public write-review modal. */
export interface ReviewTopic {
  label: string;
  count?: number;
  icon: string;
}

/**
 * Display-only projection of the owner's reply.
 * @remarks This contains derived age text instead of a raw ISO timestamp.
 */
export interface OwnerResponse {
  ageLabel: string;
  text: string;
}

/**
 * Public display projection for a single mock Google Review.
 *
 * @remarks
 * This is not the raw API response or the employee AdminGoogleReview. It is the
 * mapped presentation state with nullable fields resolved, timestamps converted
 * to relative age labels, and truncation flags.
 */
export interface PetHouseReview {
  id: string;
  reviewerName: string;
  reviewerMeta: string;
  rating: RatingStarCount;
  ageLabel: string;
  text: string;
  photoUrls: string[];
  avatarSrc?: string;
  initials?: string;
  ownerResponse?: OwnerResponse;
  isTruncated?: boolean;
  likeCount: number;
  viewerHasLiked: boolean;
  /** Kept after the name is masked, because a shared link must not imply a named reviewer. */
  isAnonymousReviewer: boolean;
}

/**
 * Aggregate data for the mock Google Business location.
 */
export interface ReviewLocation {
  id: string;
  displayName: string;
  formattedAddress: string | null;
  googleMapsUri: string | null;
  averageRating: number | null;
  totalReviews: number;
  ratingBreakdown: RatingBreakdown[];
}

/**
 * The data shape of a raw mock Google Business review as returned by the API.
 *
 * @remarks
 * This represents the public mock integration boundary. `reviewText` and
 * `ownerReply` can be null. Timestamps are ISO strings.
 */
export interface GoogleBusinessReview {
  id: string;
  reviewerName: string;
  reviewerAvatarUrl: string | null;
  reviewerIsAnonymous: boolean | null;
  rating: RatingStarCount;
  reviewText: string | null;
  photoUrls: string[];
  createdAt: string;
  updatedAt: string;
  ownerReply: string | null;
  ownerReplyUpdatedAt: string | null;
}

/**
 * A review as the public review page receives it.
 *
 * Only the public endpoint returns like state, so these fields stay off
 * {@link GoogleBusinessReview}, which the admin review surface also extends.
 */
export interface PublicGoogleBusinessReview extends GoogleBusinessReview {
  /** Total likes from every reviewer. The server returns this while signed out too. */
  likeCount: number;
  /** Always false while signed out, because an anonymous visitor has no like to match. */
  viewerHasLiked: boolean;
}

/** The raw payload returned by the public mock review endpoint. */
export interface ReviewPageData {
  location: ReviewLocation;
  reviews: PublicGoogleBusinessReview[];
}

/**
 * What a share dialog puts in front of the visitor.
 *
 * @remarks
 * The URL is absolute so it survives being pasted anywhere, and the title is the message text
 * the channels that carry one (email, WhatsApp) prefill.
 */
export interface ShareTarget {
  url: string;
  title: string;
}
