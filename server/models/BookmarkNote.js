import mongoose from 'mongoose';

import { PLATFORM_LIST } from '../config/constants.js';

/**
 * A user's personal layer on top of a problem: bookmark flag, "done" flag and
 * a free-form note. Kept separate from Problem so the shared problem corpus
 * stays read-only from the user's point of view.
 */
const bookmarkNoteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    problemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true },

    /** Denormalised so lists render without a populate round trip. */
    platform: { type: String, enum: PLATFORM_LIST, required: true },
    externalId: { type: String, required: true },

    bookmarked: { type: Boolean, default: true },
    /** User-confirmed completion; excluded from recommendations. */
    done: { type: Boolean, default: false },
    doneAt: { type: Date, default: null },
    note: { type: String, default: '', maxlength: 4000 },
  },
  { timestamps: true },
);

bookmarkNoteSchema.index({ userId: 1, problemId: 1 }, { unique: true });
bookmarkNoteSchema.index({ userId: 1, bookmarked: 1, updatedAt: -1 });
bookmarkNoteSchema.index({ userId: 1, done: 1 });

bookmarkNoteSchema.pre('save', function stampDoneAt() {
  if (this.isModified('done')) this.doneAt = this.done ? new Date() : null;
});

bookmarkNoteSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    problemId: this.problemId.toString(),
    platform: this.platform,
    externalId: this.externalId,
    bookmarked: this.bookmarked,
    done: this.done,
    note: this.note,
    updatedAt: this.updatedAt,
  };
};

export const BookmarkNote =
  mongoose.models.BookmarkNote ?? mongoose.model('BookmarkNote', bookmarkNoteSchema);

export default BookmarkNote;
