import mongoose from "mongoose";

const fileSchema = new mongoose.Schema(
  {
    filename: String,
    originalname: String,
    mimetype: String,
    size: Number,
    path: String,

    isFolder: {
      type: Boolean,
      default: false,
    },

    parentFolder: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { timestamps: true },
);

export default mongoose.model("File", fileSchema);
