using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FyBlue.Server.Data.Migrations
{
    /// <inheritdoc />
    public partial class SearchHistoryError : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Error",
                table: "SearchHistories",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Error",
                table: "SearchHistories");
        }
    }
}
