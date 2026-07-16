/**
 * Terminal presentation helpers for CRO CLI output.
 * Keep user-facing strings in English. Set CRO_NO_BANNER=1 to hide the logo.
 */

const BANNER = `
                     .:+XXxxx++:.                                  :;X$XXXXX;:.
                  :XXXXXXXXXXxXXXXX+. xXXXXXXXXXXXXXx;.        .X$$$$$$XXXXXXXXX+.
                ;$$$$$XXXXx++X$$XXXXXX;.:X$$$$$$$$$XXXXXx;   +$$$$$$$$X++xXXXXXxxx+:
              :X$$$$$X:          .;X$$$$x.           .+XXXx;$$$X$x:          :+xxx++;
             :$$$$$X:                :X$$$X:           +XXX;XXx:               .+xxxx+
            .$$$$$+                    .+X$$X.         +$XX;x                    ;XXXX+
            +$$$$X                                   .+$$$X.                      +XXXX:
            $$$$$:                        x$$$$$$$$$$$$$X:                        .XXXX;
           .$$$$$.                        +$$$:$$$$$X                             .XXXX;
            X$$$$:                        +$$$  ;$$$$$x                           ;$$$$;
            :$$$$$.                      ;+$$$    ;$$$$$+                        :$$$$X.
             +$$$$X.                   +$X+$$$.    .+$$$$$;                     .X$$$$+
              +$$$$X;               :X$$$X+$$$X.     .+$$XXX+                  ;$$$$$+
               :XXXXXXx:.      .:;$$$$&$:  :X$$$X:      ;XXXXXX:.           .+$$$$$$;
                 :xXXXXXXXX$$$$$$$$&$X                    .+xxxxXX$X;:::;X$&$$$$$$X
                    :XXXXX$$$$$$$$;.                         .;xxXXXX$$$$$$&&&&$:
                        ..:::..                                   ::;+XXXX+;:.
`.replace(/^\n/, "").replace(/\n$/, "");

let bannerPrinted = false;

export function shouldPrintBanner(): boolean {
  if (process.env.CRO_NO_BANNER === "1" || process.env.CRO_NO_BANNER === "true") {
    return false;
  }
  return true;
}

/** Print the CRO ASCII logo once per process (unless CRO_NO_BANNER=1). */
export function printBanner(stream: NodeJS.WritableStream = process.stdout): void {
  if (bannerPrinted || !shouldPrintBanner()) return;
  bannerPrinted = true;
  stream.write(`${BANNER}\n`);
  stream.write(`${rule()}\n`);
  stream.write(`  CRO  Canton Recovery Orchestration\n`);
  stream.write(`  Offline party replication  |  plan · preflight · apply · resume · drill\n`);
  stream.write(`${rule()}\n\n`);
}

export function rule(width = 72): string {
  return "-".repeat(width);
}

export function section(title: string): string {
  const t = title.toUpperCase();
  const pad = Math.max(0, 72 - t.length - 4);
  const left = Math.floor(pad / 2);
  const right = pad - left;
  return `${"=".repeat(left)}  ${t}  ${"=".repeat(right)}`;
}

export function kv(label: string, value: string, labelWidth = 12): string {
  return `  ${label.padEnd(labelWidth)} ${value}`;
}

export function bullet(text: string, indent = 4): string {
  return `${" ".repeat(indent)}- ${text}`;
}

export function stepLine(
  index: number,
  tag: string,
  id: string,
  title: string,
  note: string,
): string {
  const n = String(index).padStart(2, "0");
  return `  ${n}  [${tag.padEnd(5)}]  ${id.padEnd(24)}  ${title}  (${note})`;
}

export function outcomeLine(ok: boolean, skipped: boolean, id: string, message: string): string {
  const mark = skipped ? "~" : ok ? "OK" : "FAIL";
  const icon = skipped ? "~" : ok ? "+" : "x";
  return `  [${mark.padEnd(4)}] ${icon}  ${id}: ${message}`;
}
