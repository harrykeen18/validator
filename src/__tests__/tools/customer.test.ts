import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSqliteDb } from "../../db/sqlite.js";
import * as schema from "../../db/schema.js";

let testDb: ReturnType<typeof createSqliteDb>;

vi.mock("../../db/index.js", async () => {
  const actual = await vi.importActual<typeof import("../../db/schema.js")>("../../db/schema.js");
  return {
    ...actual,
    getDb: () => testDb,
  };
});

const { customerTools } = await import("../../tools/customer.js");

// Helper to create a project directly via the DB
function createProject() {
  return testDb.insert(schema.projects).values({ name: "Test", description: "D" }).returning().get();
}

describe("customer tools", () => {
  beforeEach(() => {
    testDb = createSqliteDb(":memory:");
  });

  it("create_icp returns the new ICP", async () => {
    const project = createProject();
    const result = await customerTools.create_icp.handler({
      projectId: project.id,
      name: "Early-stage founders",
      demographics: "25-40, technical background",
      behaviors: "Building MVPs, talking to users",
      painPoints: "No structured validation process",
      channels: "Twitter, Indie Hackers",
    });
    const icp = JSON.parse(result.content[0].text);
    expect(icp.name).toBe("Early-stage founders");
    expect(icp.projectId).toBe(project.id);
  });

  it("add_contact with minimal fields", async () => {
    const project = createProject();
    const result = await customerTools.add_contact.handler({
      projectId: project.id,
      name: "Jane Doe",
    });
    const contact = JSON.parse(result.content[0].text);
    expect(contact.name).toBe("Jane Doe");
    expect(contact.status).toBe("identified");
    expect(contact.company).toBeNull();
  });

  it("add_contact with all optional fields", async () => {
    const project = createProject();
    const icp = testDb
      .insert(schema.icps)
      .values({
        projectId: project.id,
        name: "Founders",
        demographics: "d",
        behaviors: "b",
        painPoints: "p",
        channels: "c",
      })
      .returning()
      .get();

    const result = await customerTools.add_contact.handler({
      projectId: project.id,
      icpId: icp.id,
      name: "John Smith",
      company: "Acme Inc",
      role: "CEO",
      channel: "LinkedIn",
      linkedinUrl: "https://linkedin.com/in/jsmith",
      notes: "Met at conference",
    });
    const contact = JSON.parse(result.content[0].text);
    expect(contact.company).toBe("Acme Inc");
    expect(contact.icpId).toBe(icp.id);
    expect(contact.linkedinUrl).toBe("https://linkedin.com/in/jsmith");
  });

  it("list_contacts returns all contacts for a project", async () => {
    const project = createProject();
    await customerTools.add_contact.handler({ projectId: project.id, name: "A" });
    await customerTools.add_contact.handler({ projectId: project.id, name: "B" });

    const result = await customerTools.list_contacts.handler({ projectId: project.id });
    const contacts = JSON.parse(result.content[0].text);
    expect(contacts).toHaveLength(2);
  });

  it("list_contacts filters by status", async () => {
    const project = createProject();
    await customerTools.add_contact.handler({ projectId: project.id, name: "A" });
    const bResult = await customerTools.add_contact.handler({ projectId: project.id, name: "B" });
    const bId = JSON.parse(bResult.content[0].text).id;

    await customerTools.update_contact_status.handler({ contactId: bId, status: "contacted" });

    const identified = await customerTools.list_contacts.handler({
      projectId: project.id,
      status: "identified",
    });
    expect(JSON.parse(identified.content[0].text)).toHaveLength(1);

    const contacted = await customerTools.list_contacts.handler({
      projectId: project.id,
      status: "contacted",
    });
    expect(JSON.parse(contacted.content[0].text)).toHaveLength(1);
  });

  it("update_contact_status changes status and returns next step", async () => {
    const project = createProject();
    const contactResult = await customerTools.add_contact.handler({
      projectId: project.id,
      name: "Alice",
    });
    const contactId = JSON.parse(contactResult.content[0].text).id;

    const result = await customerTools.update_contact_status.handler({
      contactId,
      status: "scheduled",
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("scheduled");
    expect(data._nextStep).toContain("generate_call_guide");
  });
});
