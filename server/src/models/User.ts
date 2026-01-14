import { Schema, model, type Document } from "mongoose";
import type { EmployeeRole, Permission } from "../lib/access";

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  roles: string[];
  permissions: Permission[];
  employeeRoles: EmployeeRole[];
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    roles: { type: [String], default: ["customer"] },
    permissions: { type: [String], default: [] },
    employeeRoles: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const User = model<IUser>("User", UserSchema);
