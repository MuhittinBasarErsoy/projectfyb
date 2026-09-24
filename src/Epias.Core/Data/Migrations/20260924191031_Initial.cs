using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Epias.Core.Data.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "app");

            migrationBuilder.CreateTable(
                name: "formulas",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Expression = table.Column<string>(type: "NVARCHAR(MAX)", nullable: false),
                    AlignmentMode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    OutputTable = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    DefaultFrom = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    DefaultTo = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_formulas", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "sync_runs",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EndpointKey = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    StartedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    FinishedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    Fetched = table.Column<int>(type: "int", nullable: false),
                    Inserted = table.Column<int>(type: "int", nullable: false),
                    Duplicates = table.Column<int>(type: "int", nullable: false),
                    Requests = table.Column<int>(type: "int", nullable: false),
                    Success = table.Column<bool>(type: "bit", nullable: false),
                    Error = table.Column<string>(type: "NVARCHAR(MAX)", nullable: true),
                    ParametersJson = table.Column<string>(type: "NVARCHAR(MAX)", nullable: true),
                    TriggeredBy = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sync_runs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "formula_runs",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FormulaId = table.Column<int>(type: "int", nullable: false),
                    StartedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    FinishedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RowsProduced = table.Column<int>(type: "int", nullable: false),
                    RowsPersisted = table.Column<int>(type: "int", nullable: false),
                    Success = table.Column<bool>(type: "bit", nullable: false),
                    Error = table.Column<string>(type: "NVARCHAR(MAX)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_formula_runs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_formula_runs_formulas_FormulaId",
                        column: x => x.FormulaId,
                        principalSchema: "app",
                        principalTable: "formulas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_formula_runs_FormulaId_StartedAt",
                schema: "app",
                table: "formula_runs",
                columns: new[] { "FormulaId", "StartedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_formulas_Name",
                schema: "app",
                table: "formulas",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sync_runs_EndpointKey_StartedAt",
                schema: "app",
                table: "sync_runs",
                columns: new[] { "EndpointKey", "StartedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "formula_runs",
                schema: "app");

            migrationBuilder.DropTable(
                name: "sync_runs",
                schema: "app");

            migrationBuilder.DropTable(
                name: "formulas",
                schema: "app");
        }
    }
}
