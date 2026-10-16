import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Singleton document holding the plant owner's email alert configuration.
 * Server-side (unlike the browser-local UI preferences) because the
 * telemetry pipeline decides on the server whether to send an email.
 */
export interface IAlertSettings extends Document {
  email: string;
  enabled: boolean;
  lastEmailAt?: Date;
}

const AlertSettingsSchema: Schema = new Schema({
  email: {
    type: String,
    default: '',
  },
  enabled: {
    type: Boolean,
    default: false,
  },
  lastEmailAt: {
    type: Date,
  },
});

const AlertSettings: Model<IAlertSettings> =
  mongoose.models.AlertSettings ||
  mongoose.model<IAlertSettings>('AlertSettings', AlertSettingsSchema);

export default AlertSettings;
