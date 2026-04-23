import * as fs from "fs";
import * as path from "path";

const rules = fs.readFileSync(
  path.resolve(__dirname, "../firestore.rules"),
  "utf8"
);
const compactRules = rules.replace(/\s+/g, " ");

describe("Firestore security rules", () => {
  test("default rule denies unmatched reads and writes", () => {
    expect(compactRules).toContain("match /{document=**}");
    expect(compactRules).toContain("allow read, write: if false;");
  });

  test("password entries are owner-only and validate encrypted payloads", () => {
    expect(compactRules).toContain("match /passwords/{docId}");
    expect(compactRules).toContain(
      "function isOwner() { return request.auth != null && request.auth.uid == userId; }"
    );
    expect(compactRules).toContain(
      "allow read, delete: if isOwner();"
    );
    expect(compactRules).toContain(
      "allow create, update: if isOwner()"
    );
    expect(compactRules).toContain(
      "request.resource.data.keys().hasAll(['encryptedData', 'iv', 'salt', 'updatedAt'])"
    );
    expect(compactRules).toContain(
      "request.resource.data.encryptedData is string"
    );
    expect(compactRules).toContain(
      "request.resource.data.encryptedData.size() <= 10000"
    );
  });

  test("password entries reject undeclared fields", () => {
    expect(compactRules).toContain("function isPasswordEntry(docId)");
    expect(compactRules).toContain('docId != "vault-meta"');
    expect(compactRules).toContain(
      "request.resource.data.keys().hasOnly(['encryptedData', 'iv', 'salt', 'updatedAt', 'createdAt', 'serviceName', 'url', 'username', 'category', 'notes', 'title', 'attachmentRef', 'expiresAt'])"
    );
    expect(compactRules).toContain(
      "request.resource.data.attachmentRef is string"
    );
    expect(compactRules).toContain("request.resource.data.expiresAt is timestamp");
  });

  test("vault verifier metadata is allowed with its own schema", () => {
    expect(compactRules).toContain("function isVaultMetadata(docId)");
    expect(compactRules).toContain('docId == "vault-meta"');
    expect(compactRules).toContain(
      "request.resource.data.keys().hasAll(['verificationCiphertext', 'verificationIv', 'verificationSalt', 'version', 'serviceName', 'username', 'url', 'createdAt', 'updatedAt'])"
    );
    expect(compactRules).toContain(
      "request.resource.data.keys().hasOnly(['verificationCiphertext', 'verificationIv', 'verificationSalt', 'version', 'serviceName', 'username', 'url', 'createdAt', 'updatedAt'])"
    );
    expect(compactRules).toContain(
      'request.resource.data.serviceName == "__mypass_vault_meta__"'
    );
  });

  test("metadata can only be read or changed by the owner with expected types", () => {
    expect(compactRules).toContain("match /metadata/{docId}");
    expect(compactRules).toContain(
      "allow read: if isOwner();"
    );
    expect(compactRules).toContain(
      "allow create, update: if isOwner()"
    );
    expect(compactRules).toContain("request.resource.data.passwordCount is int");
    expect(compactRules).toContain(
      "request.resource.data.vaultInitialized is bool"
    );
  });

  test("settings preferences are owner-only and validate user preferences", () => {
    expect(compactRules).toContain("match /settings/{docId}");
    expect(compactRules).toContain(
      'allow read: if isOwner() && docId == "preferences";'
    );
    expect(compactRules).toContain(
      'allow delete: if isOwner() && docId == "preferences";'
    );
    expect(compactRules).toContain(
      "request.resource.data.keys().hasOnly(['language', 'sessionTimeoutMinutes', 'defaultCategory', 'totpEnabled', 'totpSecret'])"
    );
    expect(compactRules).toContain(
      "request.resource.data.language in ['en', 'es']"
    );
    expect(compactRules).toContain(
      "request.resource.data.totpSecret.keys().hasAll(['ciphertext', 'iv', 'salt'])"
    );
  });

  test("audit log is owner-readable, append-only, and requires event fields", () => {
    expect(compactRules).toContain("match /auditLog/{docId}");
    expect(compactRules).toContain(
      "request.resource.data.keys().hasAll(['action', 'timestamp', 'deviceInfo'])"
    );
    expect(compactRules).toContain("allow update, delete: if false;");
  });
});
