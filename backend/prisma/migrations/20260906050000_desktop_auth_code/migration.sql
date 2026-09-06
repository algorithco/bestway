-- Desktop (Tauri) browser-login: one-time PKCE-S256 auth codes.
-- Web page creates a row -> redirects to bestway-exam://auth/callback?code=..&state=..
-- Desktop exchanges the code for session tokens via POST /auth/desktop/exchange.

-- CreateTable
CREATE TABLE "DesktopAuthCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesktopAuthCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DesktopAuthCode_codeHash_key" ON "DesktopAuthCode"("codeHash");

-- CreateIndex
CREATE INDEX "DesktopAuthCode_userId_idx" ON "DesktopAuthCode"("userId");

-- CreateIndex
CREATE INDEX "DesktopAuthCode_expiresAt_idx" ON "DesktopAuthCode"("expiresAt");

-- AddForeignKey
ALTER TABLE "DesktopAuthCode" ADD CONSTRAINT "DesktopAuthCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
