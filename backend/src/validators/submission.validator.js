const { z } = require("zod");

const submissionSchema = z.object({
  fileId: z.string().min(1),
  message: z.string().min(1),
  scheduledDate: z.string().min(1),
  inputData: z.any().optional()
});

module.exports = { submissionSchema };
