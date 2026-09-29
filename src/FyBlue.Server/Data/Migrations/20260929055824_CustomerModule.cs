using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FyBlue.Server.Data.Migrations
{
    /// <inheritdoc />
    public partial class CustomerModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CustomerId",
                table: "AspNetUsers",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Role",
                table: "AspNetUsers",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Consultant");

            migrationBuilder.CreateTable(
                name: "customers",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    customer_code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    short_name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    tax_number = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    tax_office = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    authorized_person = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    phone = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    email = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    address = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_customers", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "parameter_groups",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    is_system = table.Column<bool>(type: "bit", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_parameter_groups", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "parameter_values",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    parameter_group_id = table.Column<int>(type: "int", nullable: false),
                    code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    is_system = table.Column<bool>(type: "bit", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_parameter_values", x => x.id);
                    table.ForeignKey(
                        name: "FK_parameter_values_parameter_groups_parameter_group_id",
                        column: x => x.parameter_group_id,
                        principalTable: "parameter_groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "installations",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    customer_id = table.Column<int>(type: "int", nullable: false),
                    name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    installation_type = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    generation_type = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    distribution_company_id = table.Column<int>(type: "int", nullable: true),
                    source_address = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    manual_address = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    source_installed_power_kw = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    manual_installed_power_kw = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    source_contract_power_kw = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    manual_contract_power_kw = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    voltage_level = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    meter_type = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    latitude = table.Column<decimal>(type: "decimal(9,6)", precision: 9, scale: 6, nullable: true),
                    longitude = table.Column<decimal>(type: "decimal(9,6)", precision: 9, scale: 6, nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_installations", x => x.id);
                    table.ForeignKey(
                        name: "FK_installations_customers_customer_id",
                        column: x => x.customer_id,
                        principalTable: "customers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_installations_parameter_values_distribution_company_id",
                        column: x => x.distribution_company_id,
                        principalTable: "parameter_values",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "osos_connections",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    customer_id = table.Column<int>(type: "int", nullable: false),
                    distribution_company_id = table.Column<int>(type: "int", nullable: true),
                    connection_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    username = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    encrypted_password = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    last_connection_test_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    last_connection_status = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    last_sync_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_osos_connections", x => x.id);
                    table.ForeignKey(
                        name: "FK_osos_connections_customers_customer_id",
                        column: x => x.customer_id,
                        principalTable: "customers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_osos_connections_parameter_values_distribution_company_id",
                        column: x => x.distribution_company_id,
                        principalTable: "parameter_values",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "documents",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    customer_id = table.Column<int>(type: "int", nullable: false),
                    installation_id = table.Column<int>(type: "int", nullable: true),
                    document_type_id = table.Column<int>(type: "int", nullable: false),
                    title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    file_name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    storage_key = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    mime_type = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    file_size = table.Column<long>(type: "bigint", nullable: false),
                    document_date = table.Column<DateOnly>(type: "date", nullable: true),
                    period_year = table.Column<int>(type: "int", nullable: true),
                    period_month = table.Column<int>(type: "int", nullable: true),
                    expiry_date = table.Column<DateOnly>(type: "date", nullable: true),
                    description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    uploaded_by_user_id = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    uploaded_by_type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    deleted_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    deleted_by_user_id = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_documents", x => x.id);
                    table.ForeignKey(
                        name: "FK_documents_customers_customer_id",
                        column: x => x.customer_id,
                        principalTable: "customers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_documents_installations_installation_id",
                        column: x => x.installation_id,
                        principalTable: "installations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_documents_parameter_values_document_type_id",
                        column: x => x.document_type_id,
                        principalTable: "parameter_values",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "production_site_info",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    installation_id = table.Column<int>(type: "int", nullable: false),
                    plant_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    plant_subtype = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    ac_power_kw = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    dc_power_kwp = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    commissioning_date = table.Column<DateOnly>(type: "date", nullable: true),
                    tilt_deg = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: true),
                    azimuth_deg = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: true),
                    inverter_brand = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    inverter_model = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    inverter_quantity = table.Column<int>(type: "int", nullable: true),
                    inverter_unit_power_kw = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    panel_brand = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    panel_model = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    panel_quantity = table.Column<int>(type: "int", nullable: true),
                    panel_unit_power_wp = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_production_site_info", x => x.id);
                    table.ForeignKey(
                        name: "FK_production_site_info_installations_installation_id",
                        column: x => x.installation_id,
                        principalTable: "installations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "osos_subscriptions",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    osos_connection_id = table.Column<int>(type: "int", nullable: false),
                    installation_id = table.Column<int>(type: "int", nullable: true),
                    subscription_serno = table.Column<long>(type: "bigint", nullable: false),
                    identifier_value = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    identifier_value_sec = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    definition_type = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    source_title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    source_address = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    meter_serial = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    meter_brand = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    meter_model = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    multiplier = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    last_index_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    last_profile_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    schedule_code = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    installed_power_kw = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    contract_power_kw = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    group_info = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    etso_code = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    meter_point_assigned_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    multiplier_changed_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    min_capacitive_rate = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    min_inductive_rate = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    customer_fields_json = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_osos_subscriptions", x => x.id);
                    table.ForeignKey(
                        name: "FK_osos_subscriptions_installations_installation_id",
                        column: x => x.installation_id,
                        principalTable: "installations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_osos_subscriptions_osos_connections_osos_connection_id",
                        column: x => x.osos_connection_id,
                        principalTable: "osos_connections",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_CustomerId",
                table: "AspNetUsers",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_customers_customer_code",
                table: "customers",
                column: "customer_code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_documents_customer_id_is_active",
                table: "documents",
                columns: new[] { "customer_id", "is_active" });

            migrationBuilder.CreateIndex(
                name: "IX_documents_document_type_id",
                table: "documents",
                column: "document_type_id");

            migrationBuilder.CreateIndex(
                name: "IX_documents_installation_id",
                table: "documents",
                column: "installation_id");

            migrationBuilder.CreateIndex(
                name: "IX_installations_customer_id",
                table: "installations",
                column: "customer_id");

            migrationBuilder.CreateIndex(
                name: "IX_installations_distribution_company_id",
                table: "installations",
                column: "distribution_company_id");

            migrationBuilder.CreateIndex(
                name: "IX_osos_connections_customer_id",
                table: "osos_connections",
                column: "customer_id");

            migrationBuilder.CreateIndex(
                name: "IX_osos_connections_distribution_company_id",
                table: "osos_connections",
                column: "distribution_company_id");

            migrationBuilder.CreateIndex(
                name: "IX_osos_subscriptions_installation_id",
                table: "osos_subscriptions",
                column: "installation_id");

            migrationBuilder.CreateIndex(
                name: "IX_osos_subscriptions_osos_connection_id_subscription_serno",
                table: "osos_subscriptions",
                columns: new[] { "osos_connection_id", "subscription_serno" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_parameter_groups_code",
                table: "parameter_groups",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_parameter_values_parameter_group_id_code",
                table: "parameter_values",
                columns: new[] { "parameter_group_id", "code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_production_site_info_installation_id",
                table: "production_site_info",
                column: "installation_id",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUsers_customers_CustomerId",
                table: "AspNetUsers",
                column: "CustomerId",
                principalTable: "customers",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUsers_customers_CustomerId",
                table: "AspNetUsers");

            migrationBuilder.DropTable(
                name: "documents");

            migrationBuilder.DropTable(
                name: "osos_subscriptions");

            migrationBuilder.DropTable(
                name: "production_site_info");

            migrationBuilder.DropTable(
                name: "osos_connections");

            migrationBuilder.DropTable(
                name: "installations");

            migrationBuilder.DropTable(
                name: "customers");

            migrationBuilder.DropTable(
                name: "parameter_values");

            migrationBuilder.DropTable(
                name: "parameter_groups");

            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_CustomerId",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "CustomerId",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "Role",
                table: "AspNetUsers");
        }
    }
}
