const mongoose = require("mongoose");
const { Schema } = mongoose;

const ReportSchema = new Schema({
  owner: { type: mongoose.Schema.Types.ObjectId },
  title: String,
  phone: String,
  date: String,
  time: String,
  address: String,
  description: String,
  photos: [String],
});

const ReportModel = mongoose.model("Report", ReportSchema);
module.exports = ReportModel;
